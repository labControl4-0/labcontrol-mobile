// MOB-03: schema versionado, formulário → SQLite e persistência após reabrir o app.
import { forgetDatabaseConnection, getDatabase } from "../lib/offline/database";
import { MIGRATIONS, SCHEMA_VERSION } from "../lib/offline/schema";
import {
  createOccurrence,
  getOccurrence,
  listOccurrences,
  type NewOccurrence,
} from "../lib/offline/occurrenceRepository";
import { USER, OTHER_USER, resetStorage, simulateAppKill } from "./testUtils";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Dados sintéticos, com acentos, aspas e quebra de linha para pegar erros de escape.
const FORM: NewOccurrence = {
  userId: USER.id,
  machineId: "3f1c2a9e-0000-4000-8000-000000000001",
  machineName: "Torno CNC 01",
  sectorId: "3f1c2a9e-0000-4000-8000-0000000000a1",
  sectorName: "Usinagem",
  eventType: "failure",
  description: "Vazamento de óleo no \"cabeçote\".\nParada às 10h; operador avisado.",
  occurredAt: "2026-10-30T13:05:00.000Z",
};

beforeEach(resetStorage);

describe("schema SQLite", () => {
  it("cria as tabelas e grava a versão em PRAGMA user_version", async () => {
    const db = await getDatabase();

    const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );

    expect(version?.user_version).toBe(SCHEMA_VERSION);
    expect(tables.map((t) => t.name)).toEqual(["cache_entries", "occurrences"]);
  });

  it("reabrir um banco já migrado não roda a migração de novo", async () => {
    await getDatabase();
    await simulateAppKill();

    const { getDatabase: reopen } = require("../lib/offline/database");
    await expect(reopen()).resolves.toBeDefined();
  });

  it("recusa status de sincronização fora da lista", async () => {
    const created = await createOccurrence(FORM);
    const db = await getDatabase();

    await expect(
      db.runAsync("UPDATE occurrences SET sync_status = 'concluida' WHERE id = ?", [created.id])
    ).rejects.toThrow(/CHECK constraint/);
  });

  it("migra V1 para V2 sem perder pendências e aceita conflito", async () => {
    const db = await getDatabase();
    const createdAt = new Date().toISOString();

    await db.execAsync(
      "DROP TABLE cache_entries; DROP INDEX idx_occurrences_user_status; DROP TABLE occurrences;"
    );
    await db.execAsync(MIGRATIONS[0]);
    await db.runAsync(
      `INSERT INTO occurrences (
         id, user_id, machine_id, machine_name, sector_id, sector_name,
         event_type, description, occurred_at, sync_status, attempts,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 2, ?, ?)`,
      [
        "occ-migration-v1",
        USER.id,
        FORM.machineId,
        FORM.machineName,
        FORM.sectorId,
        FORM.sectorName,
        FORM.eventType,
        FORM.description,
        FORM.occurredAt,
        createdAt,
        createdAt,
      ]
    );
    await db.execAsync("PRAGMA user_version = 1");
    forgetDatabaseConnection();

    const upgraded = await getDatabase();
    const version = await upgraded.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const migrated = await upgraded.getFirstAsync<{
      sync_status: string;
      attempts: number;
      retry_after_at: string | null;
    }>("SELECT sync_status, attempts, retry_after_at FROM occurrences WHERE id = ?", [
      "occ-migration-v1",
    ]);

    expect(version?.user_version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
    expect(migrated).toEqual({ sync_status: "pending", attempts: 2, retry_after_at: null });
    await upgraded.runAsync(
      "UPDATE occurrences SET sync_status = 'conflict' WHERE id = ?",
      ["occ-migration-v1"]
    );
    expect(
      (await upgraded.getFirstAsync<{ sync_status: string }>(
        "SELECT sync_status FROM occurrences WHERE id = ?",
        ["occ-migration-v1"]
      ))?.sync_status
    ).toBe("conflict");
  });
});

describe("formulário → SQLite", () => {
  it("preserva todos os campos e gera UUID v4 com status pendente", async () => {
    const created = await createOccurrence(FORM);

    expect(created.id).toMatch(UUID_V4);
    expect(created).toMatchObject({
      ...FORM,
      syncStatus: "pending",
      attempts: 0,
      lastError: null,
      serverId: null,
      syncedAt: null,
    });
  });

  it("aceita setor sem nome (só o id)", async () => {
    const created = await createOccurrence({ ...FORM, sectorName: null });
    expect(created.sectorName).toBeNull();
    expect(created.sectorId).toBe(FORM.sectorId);
  });

  it("gera um UUID diferente por ocorrência", async () => {
    const a = await createOccurrence(FORM);
    const b = await createOccurrence(FORM);
    expect(a.id).not.toBe(b.id);
  });
});

describe("fechar e reabrir o app", () => {
  it("ocorrência pendente continua salva, com todos os campos", async () => {
    const created = await createOccurrence(FORM);

    await simulateAppKill();

    const repo = require("../lib/offline/occurrenceRepository");
    const reloaded = await repo.getOccurrence(USER.id, created.id);

    expect(reloaded).toEqual(created);
    expect(reloaded).toMatchObject({ ...FORM, syncStatus: "pending" });
  });

  it("envio interrompido no meio volta para pendente ao reabrir", async () => {
    const created = await createOccurrence(FORM);
    const db = await getDatabase();
    await db.runAsync("UPDATE occurrences SET sync_status = 'syncing' WHERE id = ?", [created.id]);

    await simulateAppKill();

    const repo = require("../lib/offline/occurrenceRepository");
    expect((await repo.getOccurrence(USER.id, created.id)).syncStatus).toBe("pending");
  });
});

describe("separação por usuário", () => {
  it("um usuário não vê as ocorrências de outro", async () => {
    await createOccurrence(FORM);

    expect(await listOccurrences(OTHER_USER.id)).toEqual([]);
    expect(await listOccurrences(USER.id)).toHaveLength(1);
  });

  it("buscar pelo id com outro usuário não retorna nada", async () => {
    const created = await createOccurrence(FORM);
    expect(await getOccurrence(OTHER_USER.id, created.id)).toBeNull();
  });
});
