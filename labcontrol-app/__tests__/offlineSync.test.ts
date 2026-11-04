// MOB-03: fila offline. Backend parado nunca pode deixar a ocorrência como enviada.
import { getAuthSession, saveAuthSession } from "../lib/auth";
import { SYNC_STATUS_UI } from "../lib/offline/occurrenceForm";
import {
  countUnsynced,
  createOccurrence,
  getOccurrence,
  MAX_AUTOMATIC_SYNC_ATTEMPTS,
  requeueConflict,
  requeueFailed,
  type NewOccurrence,
} from "../lib/offline/occurrenceRepository";
import { setUnauthorizedHandler } from "../services/api";
import { buildEventPayload, syncPendingOccurrences } from "../services/occurrenceSync";
import {
  API_URL,
  OTHER_TOKEN,
  OTHER_USER,
  TOKEN,
  USER,
  hangingFetch,
  mockFetch,
  resetStorage,
  simulateAppKill,
} from "./testUtils";

const FORM: NewOccurrence = {
  userId: USER.id,
  machineId: "3f1c2a9e-0000-4000-8000-000000000001",
  machineName: "Torno CNC 01",
  sectorId: "3f1c2a9e-0000-4000-8000-0000000000a1",
  sectorName: "Usinagem",
  eventType: "failure",
  description: "Vazamento de óleo no cabeçote.",
  occurredAt: "2026-10-30T13:05:00.000Z",
};

const backendDown = () => {
  const fetchMock = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

beforeEach(async () => {
  await resetStorage();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setUnauthorizedHandler(() => undefined);
  await saveAuthSession({ token: TOKEN, ...USER });
});

describe("backend parado", () => {
  it("sem rede, a ocorrência continua pendente e não aparece como enviada", async () => {
    const created = await createOccurrence(FORM);
    backendDown();

    const result = await syncPendingOccurrences();
    const after = await getOccurrence(USER.id, created.id);

    expect(result).toMatchObject({ sent: 0, remaining: 1, stoppedBy: "network" });
    expect(after?.syncStatus).toBe("pending");
    expect(after?.syncedAt).toBeNull();
    expect(after?.lastError).toMatch(/conectar/);
    expect(SYNC_STATUS_UI[after!.syncStatus].label).not.toMatch(/enviada ao servidor/i);
    expect(await countUnsynced(USER.id)).toBe(1);
  });

  it("servidor fora do ar (503) mantém pendente", async () => {
    const created = await createOccurrence(FORM);
    mockFetch({ status: 503, body: { title: "Service Unavailable" } });

    await syncPendingOccurrences();

    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("pending");
  });

  it("timeout mantém pendente", async () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = "20";
    const created = await createOccurrence(FORM);
    global.fetch = hangingFetch() as unknown as typeof fetch;

    const result = await syncPendingOccurrences();
    delete process.env.EXPO_PUBLIC_API_TIMEOUT_MS;

    expect(result?.stoppedBy).toBe("timeout");
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("pending");
  });

  it("para na primeira falha de rede e não marca as demais", async () => {
    await createOccurrence(FORM);
    await createOccurrence({ ...FORM, description: "Segunda ocorrência offline." });
    backendDown();

    await syncPendingOccurrences();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(await countUnsynced(USER.id)).toBe(2);
  });

  it("pendente continua pendente depois de fechar e reabrir o app", async () => {
    const created = await createOccurrence(FORM);
    backendDown();
    await syncPendingOccurrences();

    await simulateAppKill();

    const repo = require("../lib/offline/occurrenceRepository");
    expect((await repo.getOccurrence(USER.id, created.id)).syncStatus).toBe("pending");
  });
});

describe("backend de volta", () => {
  it("só marca como enviada depois da resposta 2xx, guardando o id do servidor", async () => {
    const created = await createOccurrence(FORM);
    const firstAttempt = backendDown();
    await syncPendingOccurrences();

    const fetchMock = mockFetch({ status: 201, body: { id: "srv-1", machineId: FORM.machineId } });
    const result = await syncPendingOccurrences({ force: true });
    const after = await getOccurrence(USER.id, created.id);

    expect(result).toMatchObject({ sent: 1, remaining: 0, stoppedBy: null });
    expect(after).toMatchObject({ syncStatus: "synced", serverId: "srv-1", lastError: null, attempts: 2 });
    expect(after?.syncedAt).not.toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/machine-events`);
    const firstBody = JSON.parse(firstAttempt.mock.calls[0][1].body);
    const retryBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(firstBody.clientId).toBe(created.id);
    expect(retryBody.clientId).toBe(created.id);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Idempotency-Key")).toBe(created.id);
  });

  it("falha parcial mantém a atual e as seguintes na fila", async () => {
    const first = await createOccurrence(FORM);
    const second = await createOccurrence({ ...FORM, description: "Segunda ocorrência." });
    const third = await createOccurrence({ ...FORM, description: "Terceira ocorrência." });
    const fetchMock = mockFetch(
      { status: 201, body: { id: "srv-1" } },
      { status: 503, body: { title: "Service Unavailable" } },
      { status: 201, body: { id: "srv-3" } }
    );

    const result = await syncPendingOccurrences({ force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ sent: 1, failed: 0, remaining: 2, stoppedBy: "server" });
    expect((await getOccurrence(USER.id, first.id))?.syncStatus).toBe("synced");
    expect(await getOccurrence(USER.id, second.id)).toMatchObject({
      syncStatus: "pending",
      attempts: 1,
    });
    expect(await getOccurrence(USER.id, third.id)).toMatchObject({
      syncStatus: "pending",
      attempts: 0,
    });
  });

  it("backoff agenda o retry e a sincronização manual pode antecipá-lo", async () => {
    const created = await createOccurrence(FORM);
    mockFetch({ status: 503, body: { title: "Service Unavailable" } });
    await syncPendingOccurrences();

    const pending = await getOccurrence(USER.id, created.id);
    expect(pending?.syncStatus).toBe("pending");
    expect(pending?.attempts).toBe(1);
    expect(Date.parse(pending!.retryAfterAt!)).toBeGreaterThan(Date.now());

    const automaticFetch = mockFetch({ status: 201, body: { id: "srv-1" } });
    const waiting = await syncPendingOccurrences();
    expect(automaticFetch).not.toHaveBeenCalled();
    expect(waiting?.stoppedBy).toBe("backoff");

    const manualFetch = mockFetch({ status: 201, body: { id: "srv-1" } });
    const result = await syncPendingOccurrences({ force: true });
    expect(manualFetch).toHaveBeenCalledTimes(1);
    expect(result?.sent).toBe(1);
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("synced");
  });

  it("para após o limite de tentativas automáticas e permite retry manual", async () => {
    const created = await createOccurrence(FORM);

    for (let attempt = 0; attempt < MAX_AUTOMATIC_SYNC_ATTEMPTS; attempt += 1) {
      mockFetch({ status: 503, body: { title: "Service Unavailable" } });
      await syncPendingOccurrences({ force: true });
    }

    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "failed",
      attempts: MAX_AUTOMATIC_SYNC_ATTEMPTS,
      retryAfterAt: null,
    });

    await requeueFailed(USER.id, created.id);
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "pending",
      attempts: 0,
      lastError: null,
      retryAfterAt: null,
    });
  });

  it("envia o corpo esperado pelo CreateMachineEventDto, com o UUID do aparelho", async () => {
    const created = await createOccurrence(FORM);
    const fetchMock = mockFetch({ status: 201, body: { id: "srv-1" } });

    await syncPendingOccurrences();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual(buildEventPayload(created));
    expect(body).toMatchObject({ machineId: FORM.machineId, eventType: "failure", clientId: created.id });
    expect(body.message).toContain(FORM.description);
    expect(body.message).toContain("Usinagem");
    expect(body.message).toContain(created.id);
  });

  it("envia na ordem em que foram criadas", async () => {
    const first = await createOccurrence(FORM);
    const second = await createOccurrence({ ...FORM, description: "Segunda ocorrência." });
    const fetchMock = mockFetch({ status: 201, body: {} }, { status: 201, body: {} });

    await syncPendingOccurrences();

    const sentIds = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).clientId);
    expect(sentIds).toEqual([first.id, second.id]);
  });

  it("chamadas simultâneas não enviam a mesma ocorrência duas vezes", async () => {
    await createOccurrence(FORM);
    const fetchMock = mockFetch({ status: 201, body: {} }, { status: 201, body: {} });

    await Promise.all([syncPendingOccurrences(), syncPendingOccurrences()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("recusa e sessão", () => {
  it("recusa do servidor (400) vira falha, sai da fila e pode ser reenviada", async () => {
    const created = await createOccurrence(FORM);
    mockFetch({ status: 400, body: { message: "Machine not found" } });

    const result = await syncPendingOccurrences();
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "failed",
      lastError: "Machine not found",
    });

    await requeueFailed(USER.id, created.id);
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("pending");
  });

  it("409 preserva a ocorrência como conflito até o retry explícito", async () => {
    const created = await createOccurrence(FORM);
    mockFetch({ status: 409, body: { message: "A versão foi alterada no servidor." } });

    const result = await syncPendingOccurrences();

    expect(result).toMatchObject({ sent: 0, failed: 0, conflicted: 1, remaining: 0 });
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "conflict",
      description: FORM.description,
      lastError: "A versão foi alterada no servidor.",
      retryAfterAt: null,
      syncedAt: null,
    });
    expect(SYNC_STATUS_UI.conflict.label).toMatch(/conflito/i);

    await requeueConflict(USER.id, created.id);
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "pending",
      lastError: null,
      attempts: 0,
    });
  });

  it("sessão expirada (401) não perde a ocorrência pendente", async () => {
    const created = await createOccurrence(FORM);
    mockFetch({ status: 401 });

    const result = await syncPendingOccurrences();

    expect(result?.stoppedBy).toBe("unauthorized");
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("pending");
  });

  it("para a fila na troca de sessão e mantém os envios restantes pendentes", async () => {
    const first = await createOccurrence(FORM);
    const second = await createOccurrence({
      ...FORM,
      description: "Segunda ocorrência ainda não enviada.",
    });
    const fetchMock = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer " + TOKEN);
      await saveAuthSession({ token: OTHER_TOKEN, ...OTHER_USER });
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ id: "srv-1" }),
      } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await syncPendingOccurrences();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ sent: 1, remaining: 1, stoppedBy: "session" });
    expect(await getOccurrence(USER.id, first.id)).toMatchObject({
      syncStatus: "synced",
      serverId: "srv-1",
    });
    expect(await getOccurrence(USER.id, second.id)).toMatchObject({
      syncStatus: "pending",
      syncedAt: null,
    });
    expect((await getAuthSession())?.user.id).toBe(OTHER_USER.id);
  });

  it("sem sessão, não tenta enviar", async () => {
    await createOccurrence(FORM);
    await resetStorage();
    const fetchMock = mockFetch();

    expect(await syncPendingOccurrences()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
