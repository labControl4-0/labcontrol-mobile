// MOB-04: migração do schema v1 (MOB-03) para v2 sem perder registros.
import * as SQLiteMock from "expo-sqlite";

import { DATABASE_NAME, forgetDatabaseConnection, getDatabase } from "../lib/offline/database";
import { MIGRATIONS, SCHEMA_VERSION } from "../lib/offline/schema";
import { USER, resetStorage } from "./testUtils";

type MockDb = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: unknown[]): Promise<unknown>;
  closeAsync(): Promise<void>;
};

beforeEach(resetStorage);

async function createV1Database() {
  const db = (await (SQLiteMock as unknown as {
    openDatabaseAsync(name: string): Promise<MockDb>;
  }).openDatabaseAsync(DATABASE_NAME)) as MockDb;

  await db.execAsync(MIGRATIONS[0]);
  await db.execAsync("PRAGMA user_version = 1");

  const insert = `INSERT INTO occurrences (id, user_id, machine_id, machine_name, sector_id,
    sector_name, event_type, description, occurred_at, sync_status, attempts, created_at, updated_at)
    VALUES (?, ?, 'm-1', 'Torno', 's-1', NULL, 'failure', ?, '2026-10-30T13:05:00.000Z', ?, ?, ?, ?)`;
  const t = "2026-10-30T13:06:00.000Z";
  await db.runAsync(insert, ["00000000-0000-4000-8000-000000000001", USER.id, "Nunca tentada", "pending", 0, t, t]);
  await db.runAsync(insert, ["00000000-0000-4000-8000-000000000002", USER.id, "Já tentada", "pending", 2, t, t]);
  await db.runAsync(insert, ["00000000-0000-4000-8000-000000000003", USER.id, "Enviada", "synced", 1, t, t]);
  await db.closeAsync();
  forgetDatabaseConnection();
}

it("migra da v1 para a v2 mantendo as ocorrências e marcando as incertas para conferência", async () => {
  await createV1Database();

  const db = await getDatabase();
  const version = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const rows = await db.getAllAsync<{ description: string; sync_status: string; needs_check: number }>(
    "SELECT description, sync_status, needs_check FROM occurrences ORDER BY id"
  );

  expect(SCHEMA_VERSION).toBe(2);
  expect(version?.user_version).toBe(2);
  expect(rows).toEqual([
    { description: "Nunca tentada", sync_status: "pending", needs_check: 0 },
    { description: "Já tentada", sync_status: "pending", needs_check: 1 },
    { description: "Enviada", sync_status: "synced", needs_check: 0 },
  ]);
});

it("a v2 aceita o estado de conflito e continua recusando estados desconhecidos", async () => {
  await createV1Database();
  const db = await getDatabase();
  const id = "00000000-0000-4000-8000-000000000001";

  await expect(
    db.runAsync("UPDATE occurrences SET sync_status = 'conflict' WHERE id = ?", [id])
  ).resolves.toBeDefined();
  await expect(
    db.runAsync("UPDATE occurrences SET sync_status = 'concluida' WHERE id = ?", [id])
  ).rejects.toThrow(/CHECK constraint/);
});
