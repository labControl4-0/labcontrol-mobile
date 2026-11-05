// Worker da fila de ocorrências. Matriz de cenários: docs/MATRIZ_CENARIOS_OFFLINE.md.
//
// Estados: pending → syncing → synced | pending (falha temporária) | failed (erro)
//          | conflict (servidor tem outra versão).
//
// Regras:
// - Só vira "synced" com resposta 2xx ou quando o evento é encontrado no servidor.
// - Se uma tentativa anterior pode ter chegado ao servidor (timeout, queda de
//   rede, 5xx, app fechado durante o envio), o app CONFERE no servidor antes de
//   reenviar. Assim, repetir depois de um timeout não duplica o evento.
// - Versão diferente no servidor (ou 409) vira "conflict" e nada é sobrescrito.
// - Falha temporária: continua "pending", com backoff exponencial e limite de
//   tentativas automáticas. Reconexão e "Sincronizar agora" ignoram o backoff.
import { AppState, type AppStateStatus } from "react-native";

import { getAuthSession } from "../lib/auth";
import {
  buildEventMessage,
  extractClientRef,
  extractDescription,
  sameText,
} from "../lib/offline/eventMessage";
import {
  getOccurrence,
  listPendingForSync,
  markConflict,
  markFailed,
  markPending,
  markPendingRetry,
  markSynced,
  markSyncing,
  type Occurrence,
  type ServerVersion,
} from "../lib/offline/occurrenceRepository";
import { ApiError, apiFetch } from "./api";

export type SyncTrigger = "manual" | "reconnect" | "auto" | "save";

export type SyncResult = {
  sent: number;
  /** Encontradas no servidor depois de uma tentativa incerta (não reenviadas). */
  recovered: number;
  failed: number;
  conflicts: number;
  remaining: number;
  /** Motivo da parada antes do fim da fila (ex.: sem conexão). */
  stoppedBy: "network" | "timeout" | "server" | "unauthorized" | "config" | "session" | null;
};

type SyncListener = () => void;
const listeners = new Set<SyncListener>();

/** Avisa telas abertas quando o estado da fila muda. */
export function subscribeToSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySyncChanged() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Uma tela com erro não pode travar a fila.
    }
  }
}

/**
 * Corpo enviado à API. O backend atual (CreateMachineEventDto) só lê
 * machineId, eventType e message. Os demais campos seguem para o contrato de
 * sincronização do BE-06 (UUID do cliente e versão local).
 */
export function buildEventPayload(o: Occurrence) {
  return {
    machineId: o.machineId,
    eventType: o.eventType,
    message: buildEventMessage(o),
    clientId: o.id,
    clientVersion: o.localVersion,
    sectorId: o.sectorId,
    description: o.description,
    occurredAt: o.occurredAt,
  };
}

type ServerEvent = {
  id?: unknown;
  clientId?: unknown;
  eventType?: unknown;
  message?: unknown;
  createdAt?: unknown;
};

const asString = (v: unknown) => (typeof v === "string" ? v : null);

function toServerVersion(event: ServerEvent | null | undefined): ServerVersion | null {
  if (!event || typeof event !== "object") return null;
  const message = asString(event.message);
  return {
    serverId: asString(event.id),
    eventType: asString(event.eventType),
    description: message === null ? null : extractDescription(message),
    message,
    createdAt: asString(event.createdAt),
  };
}

function matchesLocal(server: ServerVersion, o: Occurrence): boolean {
  return sameText(server.description, o.description) && server.eventType === o.eventType;
}

/** Procura no servidor o evento criado a partir desta ocorrência (pelo UUID). */
async function findOnServer(o: Occurrence, token: string): Promise<ServerVersion | null> {
  const events = await apiFetch(`/machine-events/machine/${o.machineId}`, { authToken: token });
  if (!Array.isArray(events)) return null;

  const found = (events as ServerEvent[]).find(
    (e) =>
      asString(e.clientId)?.toLowerCase() === o.id ||
      extractClientRef(e.message) === o.id
  );
  return toServerVersion(found);
}

function isPermanentRejection(error: ApiError) {
  if (error.code !== "http" || error.status === undefined) return false;
  // 408 e 429 são temporários; o resto dos 4xx é recusa do conteúdo.
  return error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

/** O servidor pode ter gravado o evento mesmo sem a resposta chegar ao app. */
function mayHaveReachedServer(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.code === "timeout" || error.code === "network") return true;
  return error.code === "http" && (error.status ?? 0) >= 500;
}

function stopReason(error: unknown): SyncResult["stoppedBy"] {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "http") return "server";
  return error.code;
}

async function isSameSession(userId: string, token: string): Promise<boolean> {
  try {
    const current = await getAuthSession();
    return current?.user.id === userId && current.token === token;
  } catch {
    return false;
  }
}

type ItemOutcome = "sent" | "recovered" | "failed" | "conflict" | { stop: SyncResult["stoppedBy"] };

async function syncOne(o: Occurrence, token: string): Promise<ItemOutcome> {
  try {
    if (o.needsCheck) {
      const server = await findOnServer(o, token);
      if (server) {
        if (matchesLocal(server, o)) {
          await markSynced(o.id, server.serverId);
          return "recovered";
        }
        await markConflict(
          o.id,
          { reason: "content_mismatch", server },
          "O servidor já tem esta ocorrência com outro conteúdo."
        );
        return "conflict";
      }
      // Não está no servidor: segue para o envio normal.
    }

    const response = await apiFetch("/machine-events", {
      method: "POST",
      body: JSON.stringify(buildEventPayload(o)),
      headers: { "Idempotency-Key": o.id },
      authToken: token,
    });

    await markSynced(o.id, asString(response?.id));
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";

    if (error instanceof ApiError && error.status === 409) {
      const body = error.data as { current?: ServerEvent } | ServerEvent | undefined;
      const server = toServerVersion(
        body && typeof body === "object" && "current" in body ? body.current : (body as ServerEvent)
      );
      await markConflict(o.id, { reason: "server_conflict", server }, message);
      return "conflict";
    }

    if (error instanceof ApiError && isPermanentRejection(error)) {
      await markFailed(o.id, message);
      return "failed";
    }

    await markPendingRetry(o.id, message, { mayHaveReached: mayHaveReachedServer(error) });
    return { stop: stopReason(error) };
  }
}

async function runSync(userId: string, token: string, force: boolean): Promise<SyncResult> {
  const queue = await listPendingForSync(userId, { force });
  const result: SyncResult = {
    sent: 0,
    recovered: 0,
    failed: 0,
    conflicts: 0,
    remaining: queue.length,
    stoppedBy: null,
  };

  for (const queued of queue) {
    // Não continue a fila de uma conta depois de logout ou troca de usuário.
    if (!(await isSameSession(userId, token))) {
      result.stoppedBy = "session";
      break;
    }

    // Reserva atômica: se outra execução ou uma edição mudou o estado, pula.
    if (!(await markSyncing(queued.id))) {
      result.remaining -= 1;
      continue;
    }
    notifySyncChanged();

    // markSyncing pode aguardar o SQLite; confira de novo antes da requisição.
    if (!(await isSameSession(userId, token))) {
      await markPending(queued.id);
      result.stoppedBy = "session";
      notifySyncChanged();
      break;
    }

    // Relê depois da reserva: edições feitas depois da leitura da fila valem.
    const fresh = (await getOccurrence(userId, queued.id)) ?? queued;
    const outcome = await syncOne(fresh, token);
    notifySyncChanged();

    if (typeof outcome === "object") {
      result.stoppedBy = outcome.stop;
      break;
    }

    result.remaining -= 1;
    if (outcome === "sent") result.sent += 1;
    else if (outcome === "recovered") result.recovered += 1;
    else if (outcome === "failed") result.failed += 1;
    else result.conflicts += 1;
  }

  return result;
}

// ─── Execução única com coalescência ──────────────────────────────────────────
// Só uma execução roda por vez. Pedidos que chegam durante uma execução viram
// UMA execução seguinte (não várias), para que um gatilho como a reconexão não
// se perca nem dispare envios em paralelo.

let running: Promise<SyncResult | null> | null = null;
let rerun: { force: boolean; promise: Promise<SyncResult | null> } | null = null;

function start(force: boolean): Promise<SyncResult | null> {
  running = (async () => {
    const session = await getAuthSession();
    const userId = session?.user.id;
    return userId ? runSync(userId, session.token, force) : null;
  })().finally(() => {
    running = null;
  });
  return running;
}

export function syncPendingOccurrences(
  options: { force?: boolean; trigger?: SyncTrigger } = {}
): Promise<SyncResult | null> {
  const force = options.force ?? options.trigger !== "auto";

  if (!running) return start(force);

  if (rerun) {
    rerun.force = rerun.force || force;
    return rerun.promise;
  }

  const pending = { force, promise: null as unknown as Promise<SyncResult | null> };
  pending.promise = running
    .catch(() => null)
    .then(() => {
      rerun = null;
      return syncPendingOccurrences({ force: pending.force });
    });
  rerun = pending;
  return pending.promise;
}

/** Resolve quando não há execução em andamento nem agendada (usado em testes). */
export async function waitForSyncIdle(): Promise<void> {
  while (running || rerun) {
    await (rerun?.promise ?? running)?.catch(() => null);
  }
}

// ─── Gatilhos automáticos ─────────────────────────────────────────────────────

/** Intervalo entre tentativas automáticas enquanto o app está aberto. */
export const AUTO_SYNC_INTERVAL_MS = 30 * 1000;

/** Tenta enviar ao abrir o app, ao voltar para ele e a cada 30 s, respeitando o backoff. */
export function startAutoSync(): () => void {
  const trySync = () => {
    syncPendingOccurrences({ trigger: "auto" }).catch(() => undefined);
  };

  trySync();
  const timer = setInterval(() => {
    if (AppState.currentState === "active") trySync();
  }, AUTO_SYNC_INTERVAL_MS);

  const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") trySync();
  });

  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}

export type ConnectivityState = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
};

export type ConnectivitySource = {
  subscribe(listener: (state: ConnectivityState) => void): () => void;
  getCurrent(): Promise<ConnectivityState>;
};

/** Agrupa eventos de rede que chegam em sequência (ex.: Wi-Fi oscilando). */
export const RECONNECT_DEBOUNCE_MS = 1500;

const isOnline = (s: ConnectivityState) =>
  s.isConnected === true && s.isInternetReachable !== false;

/**
 * Sincroniza quando a conexão volta. Só a passagem de offline para online
 * dispara, e eventos seguidos dentro de RECONNECT_DEBOUNCE_MS viram um único
 * envio. Retorna a função de parada.
 */
export function startReconnectSync(
  source: ConnectivitySource,
  debounceMs: number = RECONNECT_DEBOUNCE_MS
): () => void {
  let online: boolean | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const handle = (state: ConnectivityState) => {
    const now = isOnline(state);
    const cameBack = online === false && now;
    online = now;

    if (!now && timer) {
      // Caiu de novo antes do envio: espera a próxima volta.
      clearTimeout(timer);
      timer = null;
    }

    if (cameBack && !timer) {
      timer = setTimeout(() => {
        timer = null;
        if (!stopped && online) {
          syncPendingOccurrences({ trigger: "reconnect" }).catch(() => undefined);
        }
      }, debounceMs);
    }
  };

  const unsubscribe = source.subscribe(handle);
  source
    .getCurrent()
    .then((state) => {
      // O primeiro estado só serve de referência: não dispara envio sozinho.
      if (online === null) online = isOnline(state);
    })
    .catch(() => undefined);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
