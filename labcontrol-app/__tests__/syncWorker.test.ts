// MOB-04: worker da fila, reconexão, falha parcial, duplicidade, reinício,
// backoff e conflitos. Cada bloco corresponde a uma linha de
// docs/MATRIZ_CENARIOS_OFFLINE.md (código entre colchetes).
import * as Network from "expo-network";

import { saveAuthSession } from "../lib/auth";
import { getDatabase } from "../lib/offline/database";
import { buildEventMessage } from "../lib/offline/eventMessage";
import {
  countUnsynced,
  createOccurrence,
  getOccurrence,
  listOccurrences,
  resolveConflictKeepBoth,
  resolveConflictKeepServer,
  updateOccurrence,
  type NewOccurrence,
} from "../lib/offline/occurrenceRepository";
import { MAX_AUTO_RETRIES, nextAttemptDelay } from "../lib/offline/syncPolicy";
import { setUnauthorizedHandler } from "../services/api";
import {
  startReconnectSync,
  syncPendingOccurrences,
  waitForSyncIdle,
  type ConnectivitySource,
} from "../services/occurrenceSync";
import { createFakeApi, sleep, waitUntil, type FakeApi } from "./fakeApi";
import { API_URL, TOKEN, USER, resetStorage, simulateAppKill } from "./testUtils";

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

const create = (description: string) => createOccurrence({ ...FORM, description });

/** Quantos eventos o servidor tem para cada UUID do app (detecta duplicatas). */
function eventsPerRef(api: FakeApi) {
  const counts: Record<string, number> = {};
  for (const e of api.events) {
    const ref = /Ref\. app: (\S+)$/.exec(e.message)?.[1] ?? "sem-ref";
    counts[ref] = (counts[ref] ?? 0) + 1;
  }
  return counts;
}

let api: FakeApi;

beforeEach(async () => {
  await resetStorage();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  delete process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  setUnauthorizedHandler(() => undefined);
  await saveAuthSession({ token: TOKEN, ...USER });
  api = createFakeApi();
});

afterEach(async () => {
  await waitForSyncIdle();
  jest.restoreAllMocks();
});

// ─── [R] Reconexão ────────────────────────────────────────────────────────────

describe("[R] reconexão", () => {
  const network = Network as unknown as {
    __emit: (s: object) => void;
    __setCurrent: (s: object) => void;
  };
  const OFFLINE = { isConnected: false, isInternetReachable: false };
  const ONLINE = { isConnected: true, isInternetReachable: true };

  const source: ConnectivitySource = {
    subscribe: (listener) => {
      const sub = Network.addNetworkStateListener(listener as never);
      return () => sub.remove();
    },
    getCurrent: () => Network.getNetworkStateAsync(),
  };

  async function startOffline() {
    network.__setCurrent(OFFLINE);
    const stop = startReconnectSync(source, 20);
    await sleep(5); // estado inicial registrado
    return stop;
  }

  it("[R1] vários eventos de volta da rede sincronizam cada pendência uma vez só", async () => {
    await create("Primeira offline.");
    await create("Segunda offline.");
    await create("Terceira offline.");
    const stop = await startOffline();

    // Rede oscilando: o sistema avisa várias vezes em sequência.
    network.__emit(ONLINE);
    network.__emit({ isConnected: true, isInternetReachable: null });
    network.__emit(ONLINE);
    network.__emit(OFFLINE);
    network.__emit(ONLINE);
    await sleep(60);
    await waitForSyncIdle();

    expect(api.posts).toHaveLength(3);
    expect(Object.values(eventsPerRef(api))).toEqual([1, 1, 1]);
    expect(await countUnsynced(USER.id)).toBe(0);

    // Já online: novos avisos de "conectado" não disparam outro envio.
    network.__emit(ONLINE);
    await sleep(60);
    await waitForSyncIdle();
    expect(api.fetchMock).toHaveBeenCalledTimes(3);
    stop();
  });

  it("[R2] o estado inicial da rede não dispara envio sozinho", async () => {
    await create("Pendente na abertura.");
    network.__setCurrent(ONLINE);
    const stop = startReconnectSync(source, 20);
    network.__emit(ONLINE);
    await sleep(60);

    expect(api.fetchMock).not.toHaveBeenCalled();
    stop();
  });

  it("[R3] cair de novo antes do envio cancela o disparo", async () => {
    await create("Pendente.");
    const stop = await startOffline();

    network.__emit(ONLINE);
    network.__emit(OFFLINE);
    await sleep(60);

    expect(api.fetchMock).not.toHaveBeenCalled();
    stop();
  });

  it("[R4] reconexão durante um envio em andamento não se perde e não duplica", async () => {
    const created = await create("Enviada durante a reconexão.");
    api.holdNextRequest();

    const first = syncPendingOccurrences({ trigger: "auto" });
    await waitUntil(() => api.held !== null);

    // A conexão volta enquanto a primeira tentativa está presa e vai falhar.
    // A espera garante que o pedido da reconexão chegue antes da falha: se ele
    // rodasse em paralelo, veria o item "enviando" e não faria nada.
    const onReconnect = syncPendingOccurrences({ trigger: "reconnect" });
    await sleep(50);
    api.held!.fail();

    await first;
    const result = await onReconnect;

    expect(result).toMatchObject({ sent: 1, remaining: 0 });
    expect(api.posts).toHaveLength(1);
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("synced");
  });

  it("[R5] o acionamento manual também envia uma vez", async () => {
    await create("Manual.");

    await Promise.all([
      syncPendingOccurrences({ trigger: "manual" }),
      syncPendingOccurrences({ trigger: "manual" }),
      syncPendingOccurrences({ trigger: "manual" }),
    ]);

    expect(api.posts).toHaveLength(1);
  });
});

// ─── [P] Falha parcial ────────────────────────────────────────────────────────

describe("[P] falha parcial", () => {
  it("[P1] a fila para no erro temporário: enviadas ficam enviadas, o resto fica pendente", async () => {
    const a = await create("A");
    const b = await create("B");
    const c = await create("C");
    api.planPosts("ok", 503);

    const result = await syncPendingOccurrences();

    expect(result).toMatchObject({ sent: 1, remaining: 2, stoppedBy: "server" });
    expect((await getOccurrence(USER.id, a.id))?.syncStatus).toBe("synced");
    expect(await getOccurrence(USER.id, b.id)).toMatchObject({
      syncStatus: "pending",
      needsCheck: true,
      retryCount: 1,
    });
    expect(await getOccurrence(USER.id, c.id)).toMatchObject({ syncStatus: "pending", attempts: 0 });

    const retry = await syncPendingOccurrences();

    expect(retry).toMatchObject({ sent: 2, remaining: 0 });
    expect(Object.values(eventsPerRef(api))).toEqual([1, 1, 1]);
  });

  it("[P2] recusa de uma ocorrência (400) não trava as próximas", async () => {
    const a = await create("A");
    const b = await create("B");
    api.planPosts(400, "ok");

    const result = await syncPendingOccurrences();

    expect(result).toMatchObject({ sent: 1, failed: 1, remaining: 0 });
    expect((await getOccurrence(USER.id, a.id))?.syncStatus).toBe("failed");
    expect((await getOccurrence(USER.id, b.id))?.syncStatus).toBe("synced");
    expect(await countUnsynced(USER.id)).toBe(1);
  });

  it("[P3] backend parado no meio da fila mantém todas as restantes pendentes", async () => {
    await create("A");
    await create("B");
    api.planPosts("ok", "down");

    await syncPendingOccurrences();

    expect(await countUnsynced(USER.id)).toBe(1);
    expect(api.events).toHaveLength(1);
  });
});

// ─── [D] Duplicidade ──────────────────────────────────────────────────────────

describe("[D] duplicidade", () => {
  it("[D1] repetir depois de um timeout não duplica: o app confere e encontra o evento", async () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = "30";
    const created = await create("Gravada, mas a resposta se perdeu.");
    api.planPosts("commitThenTimeout");

    const first = await syncPendingOccurrences();

    // O servidor gravou, mas o app não sabe: continua pendente, para conferir.
    expect(first?.stoppedBy).toBe("timeout");
    expect(api.events).toHaveLength(1);
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "pending",
      needsCheck: true,
    });

    const second = await syncPendingOccurrences();

    expect(second).toMatchObject({ sent: 0, recovered: 1 });
    expect(api.posts).toHaveLength(1);
    expect(api.events).toHaveLength(1);
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "synced",
      serverId: "srv-1",
      needsCheck: false,
    });
  });

  it("[D2] timeout antes de gravar: a conferência não encontra nada e o app envia uma vez", async () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = "30";
    const created = await create("Não chegou ao servidor.");
    api.planPosts("down");

    await syncPendingOccurrences();
    expect(api.events).toHaveLength(0);

    const result = await syncPendingOccurrences();

    expect(result).toMatchObject({ sent: 1, recovered: 0 });
    expect(eventsPerRef(api)).toEqual({ [created.id]: 1 });
  });

  it("[D3] se a conferência falhar, o app NÃO reenvia às cegas", async () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = "30";
    const created = await create("Conferência sem rede.");
    api.planPosts("commitThenTimeout");
    await syncPendingOccurrences();

    api.setDown(true);
    await syncPendingOccurrences();

    expect(api.posts).toHaveLength(1);
    expect((await getOccurrence(USER.id, created.id))?.needsCheck).toBe(true);
  });

  it("[D4] o POST leva Idempotency-Key e clientId iguais ao UUID local", async () => {
    const created = await create("Com chave de idempotência.");

    await syncPendingOccurrences();

    expect(api.idempotencyKeys).toEqual([created.id]);
    expect(api.posts[0]).toMatchObject({ clientId: created.id, clientVersion: 1 });
  });
});

// ─── [I] Reinício ─────────────────────────────────────────────────────────────

describe("[I] reinício do app", () => {
  it("[I1] app fechado durante o envio: ao reabrir, confere e não duplica", async () => {
    const created = await create("Envio interrompido pelo sistema.");
    // O servidor já tinha gravado quando o app foi encerrado no meio do envio.
    api.events.push({
      id: "srv-99",
      machineId: FORM.machineId,
      eventType: FORM.eventType,
      message: buildEventMessage(created),
      createdAt: new Date().toISOString(),
    });
    const db = await getDatabase();
    await db.runAsync("UPDATE occurrences SET sync_status = 'syncing' WHERE id = ?", [created.id]);

    await simulateAppKill();

    const sync = require("../services/occurrenceSync");
    const repo = require("../lib/offline/occurrenceRepository");
    const reopened = await repo.getOccurrence(USER.id, created.id);
    expect(reopened).toMatchObject({ syncStatus: "pending", needsCheck: true });

    const result = await sync.syncPendingOccurrences();

    expect(result).toMatchObject({ sent: 0, recovered: 1 });
    expect(api.posts).toHaveLength(0);
    expect(api.events).toHaveLength(1);
    expect(await repo.getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "synced",
      serverId: "srv-99",
    });
  });

  it("[I2] app fechado com pendências e backend parado: ao reabrir com backend de volta, envia tudo uma vez", async () => {
    await create("A");
    await create("B");
    api.setDown(true);
    await syncPendingOccurrences();

    await simulateAppKill();
    api.setDown(false);

    const sync = require("../services/occurrenceSync");
    const result = await sync.syncPendingOccurrences();

    expect(result).toMatchObject({ remaining: 0 });
    expect(Object.values(eventsPerRef(api))).toEqual([1, 1]);
  });
});

// ─── [B] Retry com backoff ────────────────────────────────────────────────────

describe("[B] retry limitado com backoff", () => {
  it("[B1] o timer respeita a espera; reconexão e botão manual ignoram", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const created = await create("Com backoff.");
    api.setDown(true);
    await syncPendingOccurrences({ trigger: "auto" });

    const after = await getOccurrence(USER.id, created.id);
    expect(after).toMatchObject({ retryCount: 1, nextAttemptAt: 1_000_000 + nextAttemptDelay(1) });

    api.setDown(false);
    api.fetchMock.mockClear();

    now.mockReturnValue(1_000_000 + nextAttemptDelay(1) - 1);
    await syncPendingOccurrences({ trigger: "auto" });
    expect(api.fetchMock).not.toHaveBeenCalled();

    await syncPendingOccurrences({ trigger: "manual" });
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("synced");
  });

  it("[B2] espera cresce em dobro até o teto", () => {
    expect([1, 2, 3, 4].map(nextAttemptDelay)).toEqual([5000, 10000, 20000, 40000]);
    expect(nextAttemptDelay(50)).toBe(10 * 60 * 1000);
  });

  it("[B3] depois do limite, o timer para, mas a ocorrência continua pendente", async () => {
    const now = jest.spyOn(Date, "now");
    let clock = 0;
    now.mockImplementation(() => clock);
    const created = await create("Limite de tentativas.");
    api.setDown(true);

    for (let i = 0; i < MAX_AUTO_RETRIES; i++) {
      clock += 60 * 60 * 1000; // passa a espera
      await syncPendingOccurrences({ trigger: "auto" });
    }

    api.fetchMock.mockClear();
    clock += 24 * 60 * 60 * 1000;
    await syncPendingOccurrences({ trigger: "auto" });

    expect(api.fetchMock).not.toHaveBeenCalled();
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "pending",
      retryCount: MAX_AUTO_RETRIES,
    });

    api.setDown(false);
    await syncPendingOccurrences({ trigger: "reconnect" });
    expect((await getOccurrence(USER.id, created.id))?.syncStatus).toBe("synced");
  });
});

// ─── [C] Conflito ─────────────────────────────────────────────────────────────

describe("[C] conflito", () => {
  async function editedAfterUncertainSend() {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = "30";
    const created = await create("Versão original.");
    api.planPosts("commitThenTimeout");
    await syncPendingOccurrences();

    // O usuário edita achando que não foi enviada, mas o servidor já tem a original.
    const edited = await updateOccurrence(USER.id, created.id, {
      eventType: "warning",
      description: "Versão editada no aparelho.",
      occurredAt: FORM.occurredAt,
    });
    expect(edited).toBe(true);

    const result = await syncPendingOccurrences();
    return { created, result };
  }

  it("[C1] versão diferente no servidor vira conflito e nada é sobrescrito", async () => {
    const { created, result } = await editedAfterUncertainSend();

    expect(result).toMatchObject({ conflicts: 1, sent: 0, recovered: 0 });
    expect(api.posts).toHaveLength(1);
    expect(api.events[0].message).toContain("Versão original.");

    const local = await getOccurrence(USER.id, created.id);
    expect(local).toMatchObject({
      syncStatus: "conflict",
      description: "Versão editada no aparelho.",
      eventType: "warning",
      localVersion: 2,
    });
    expect(local?.conflict).toMatchObject({
      reason: "content_mismatch",
      server: { serverId: "srv-1", eventType: "failure", description: "Versão original." },
    });
    expect(await countUnsynced(USER.id)).toBe(1);
  });

  it("[C2] em conflito, a fila não tenta de novo sozinha", async () => {
    await editedAfterUncertainSend();
    api.fetchMock.mockClear();

    await syncPendingOccurrences({ trigger: "manual" });
    await syncPendingOccurrences({ trigger: "reconnect" });

    expect(api.fetchMock).not.toHaveBeenCalled();
  });

  it("[C3] resolver mantendo a versão do servidor descarta a edição local, por escolha do usuário", async () => {
    const { created } = await editedAfterUncertainSend();

    expect(await resolveConflictKeepServer(USER.id, created.id)).toBe(true);

    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "synced",
      description: "Versão original.",
      eventType: "failure",
      serverId: "srv-1",
      conflict: null,
    });
    expect(api.events).toHaveLength(1);
  });

  it("[C4] resolver mantendo as duas envia a versão local como ocorrência nova", async () => {
    const { created } = await editedAfterUncertainSend();

    const copy = await resolveConflictKeepBoth(USER.id, created.id);
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(created.id);

    await syncPendingOccurrences();

    expect(api.events.map((e) => e.message.split("\n")[0])).toEqual([
      "Versão original.",
      "Versão editada no aparelho.",
    ]);
    expect(eventsPerRef(api)).toEqual({ [created.id]: 1, [copy!.id]: 1 });
    expect((await listOccurrences(USER.id)).every((o) => o.syncStatus === "synced")).toBe(true);
  });

  it("[C5] resposta 409 do servidor vira conflito com a versão dele", async () => {
    const created = await create("Recusada por conflito.");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () =>
        JSON.stringify({
          message: "Versão desatualizada.",
          current: { id: "srv-7", eventType: "note", message: "Versão do servidor." },
        }),
    }) as unknown as typeof fetch;

    const result = await syncPendingOccurrences();

    expect(result).toMatchObject({ conflicts: 1 });
    expect(await getOccurrence(USER.id, created.id)).toMatchObject({
      syncStatus: "conflict",
      lastError: "Versão desatualizada.",
      conflict: { reason: "server_conflict", server: { serverId: "srv-7", eventType: "note" } },
    });
  });

  it("[C6] não dá para editar durante o envio, nem depois de enviada", async () => {
    const created = await create("Bloqueio de edição.");
    const edit = { eventType: "note", description: "Mudança tardia.", occurredAt: FORM.occurredAt };
    api.holdNextRequest();

    const running = syncPendingOccurrences();
    await waitUntil(() => api.held !== null);
    expect(await updateOccurrence(USER.id, created.id, edit)).toBe(false);

    api.held!.release();
    await running;

    expect(await updateOccurrence(USER.id, created.id, edit)).toBe(false);
    expect(api.posts[0]).toMatchObject({ description: "Bloqueio de edição." });
  });

  it("[C7] edição feita antes do envio vale: o app envia a versão mais nova", async () => {
    const created = await create("Antes da edição.");
    await updateOccurrence(USER.id, created.id, {
      eventType: "maintenance",
      description: "Depois da edição.",
      occurredAt: FORM.occurredAt,
    });

    await syncPendingOccurrences();

    expect(api.posts[0]).toMatchObject({
      description: "Depois da edição.",
      eventType: "maintenance",
      clientVersion: 2,
    });
  });
});
