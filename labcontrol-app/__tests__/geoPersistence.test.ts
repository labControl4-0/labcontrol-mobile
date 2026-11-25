// Persistência das coordenadas no SQLite e envio da localização da ocorrência.
// Dados sintéticos.
import { saveAuthSession } from "../lib/auth";
import {
  deleteMachineLocation,
  listMachineLocations,
  saveMachineLocation,
} from "../lib/geo/machineLocationRepository";
import { getDatabase } from "../lib/offline/database";
import {
  buildEventMessage,
  extractClientRef,
  extractDescription,
} from "../lib/offline/eventMessage";
import {
  createOccurrence,
  getOccurrence,
  resolveConflictKeepBoth,
  type NewOccurrence,
} from "../lib/offline/occurrenceRepository";
import { setUnauthorizedHandler } from "../services/api";
import { buildEventPayload, syncPendingOccurrences } from "../services/occurrenceSync";
import { API_URL, OTHER_USER, TOKEN, USER, mockFetch, resetStorage, simulateAppKill } from "./testUtils";

const PIN = {
  machineId: "m-1",
  machineName: "Torno CNC 01",
  plantId: "p-1",
  latitude: -23.5003,
  longitude: -47.4582,
  accuracy: 7.5,
};

const FORM: NewOccurrence = {
  userId: USER.id,
  machineId: "3f1c2a9e-0000-4000-8000-000000000001",
  machineName: "Torno CNC 01",
  sectorId: "3f1c2a9e-0000-4000-8000-0000000000a1",
  sectorName: "Usinagem",
  eventType: "failure",
  description: "Vazamento de óleo no cabeçote.",
  occurredAt: "2026-11-16T13:05:00.000Z",
};

const LOCATION = { latitude: -23.5003, longitude: -47.4582, accuracy: 8.4 };

beforeEach(async () => {
  await resetStorage();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setUnauthorizedHandler(() => undefined);
  await saveAuthSession({ token: TOKEN, ...USER });
});

describe("posição de máquina fixada no aparelho", () => {
  it("salva, lista e sobrevive ao app ser fechado", async () => {
    const saved = await saveMachineLocation(USER.id, { ...PIN, capturedAt: "2026-11-16T13:00:00.000Z" });
    expect(saved).toEqual({ ...PIN, capturedAt: "2026-11-16T13:00:00.000Z" });

    await simulateAppKill();
    const { listMachineLocations: listAfterRestart } = require("../lib/geo/machineLocationRepository");
    await expect(listAfterRestart(USER.id)).resolves.toEqual([saved]);
  });

  it("fixar de novo substitui a posição anterior", async () => {
    await saveMachineLocation(USER.id, PIN);
    await saveMachineLocation(USER.id, { ...PIN, latitude: -23.6, longitude: -47.5, accuracy: null });

    const list = await listMachineLocations(USER.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ latitude: -23.6, longitude: -47.5, accuracy: null });
  });

  it("cada usuário só vê as próprias posições", async () => {
    await saveMachineLocation(USER.id, PIN);
    await saveMachineLocation(OTHER_USER.id, { ...PIN, latitude: 1, longitude: 1 });

    expect((await listMachineLocations(USER.id)).map((p) => p.latitude)).toEqual([-23.5003]);
    expect((await listMachineLocations(OTHER_USER.id)).map((p) => p.latitude)).toEqual([1]);
  });

  it("remove a posição e informa quando não havia nada", async () => {
    await saveMachineLocation(USER.id, PIN);
    await expect(deleteMachineLocation(USER.id, "m-1")).resolves.toBe(true);
    await expect(deleteMachineLocation(USER.id, "m-1")).resolves.toBe(false);
    await expect(listMachineLocations(USER.id)).resolves.toEqual([]);
  });

  it.each([
    [{ latitude: 91, longitude: 0 }],
    [{ latitude: 0, longitude: -181 }],
    [{ latitude: Number.NaN, longitude: 0 }],
  ])("recusa coordenada inválida %j", async (coords) => {
    await expect(saveMachineLocation(USER.id, { ...PIN, ...coords })).rejects.toThrow(/inválidas/);
    await expect(listMachineLocations(USER.id)).resolves.toEqual([]);
  });

  it("precisão inválida é guardada como desconhecida", async () => {
    const saved = await saveMachineLocation(USER.id, { ...PIN, accuracy: -5 });
    expect(saved.accuracy).toBeNull();
  });

  it("o banco também recusa coordenada fora da faixa (CHECK)", async () => {
    const db = await getDatabase();
    await expect(
      db.runAsync(
        `INSERT INTO machine_locations (user_id, machine_id, machine_name, latitude, longitude, captured_at)
         VALUES (?, 'm-x', 'X', 95, 0, '2026-11-16T13:00:00.000Z')`,
        [USER.id]
      )
    ).rejects.toThrow(/CHECK constraint/);
  });
});

describe("localização do técnico na ocorrência", () => {
  it("é opcional: sem ela a ocorrência fica com location null", async () => {
    const created = await createOccurrence(FORM);
    expect(created.location).toBeNull();
    expect(buildEventMessage(created)).not.toContain("Local:");
    expect(buildEventPayload(created)).not.toHaveProperty("latitude");
  });

  it("é gravada no SQLite e sobrevive ao app ser fechado", async () => {
    const created = await createOccurrence({ ...FORM, location: LOCATION });
    expect(created.location).toEqual(LOCATION);

    await simulateAppKill();
    const { getOccurrence: getAfterRestart } = require("../lib/offline/occurrenceRepository");
    const after = await getAfterRestart(USER.id, created.id);
    expect(after.location).toEqual(LOCATION);
  });

  it("recusa coordenada inválida em vez de descartar em silêncio", async () => {
    await expect(
      createOccurrence({ ...FORM, location: { latitude: -95, longitude: 0, accuracy: null } })
    ).rejects.toThrow(/Localização inválida/);
  });

  it("entra na mensagem sem atrapalhar a referência do app nem a descrição", async () => {
    const created = await createOccurrence({ ...FORM, location: LOCATION });
    const message = buildEventMessage(created);

    expect(message).toContain("Local: -23.500300, -47.458200 (±8 m) | Ref. app: ");
    expect(extractClientRef(message)).toBe(created.id);
    expect(extractDescription(message)).toBe(FORM.description);
  });

  it("vai ao servidor em campos próprios e dentro da message", async () => {
    const created = await createOccurrence({ ...FORM, location: LOCATION });
    const fetchMock = mockFetch({ status: 201, body: { id: "srv-1" } });

    const result = await syncPendingOccurrences();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);

    expect(result).toMatchObject({ sent: 1 });
    expect(body).toEqual(buildEventPayload(created));
    expect(body).toMatchObject({ latitude: -23.5003, longitude: -47.4582, locationAccuracy: 8.4 });
    expect(body.message).toContain("Local: -23.500300, -47.458200");
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("synced");
  });

  it("'manter as duas' num conflito preserva a localização na cópia", async () => {
    const created = await createOccurrence({ ...FORM, location: LOCATION });
    const db = await getDatabase();
    await db.runAsync(
      "UPDATE occurrences SET sync_status = 'conflict', conflict_json = ? WHERE id = ?",
      [JSON.stringify({ reason: "server_conflict", detectedAt: "2026-11-16T13:10:00.000Z", server: null }), created.id]
    );

    const copy = await resolveConflictKeepBoth(USER.id, created.id);
    expect(copy?.location).toEqual(LOCATION);
    expect(copy?.id).not.toBe(created.id);
  });
});
