// Envio da fila de ocorrências para POST /machine-events.
//
// Uma ocorrência só vira "synced" depois de uma resposta 2xx do servidor.
// Sem rede, timeout, 5xx ou 401: continua "pending" e é reenviada depois.
// Recusa definitiva (4xx): vira "failed" e espera o usuário pedir de novo.
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";

import { getAuthSession } from "../lib/auth";
import { eventTypeLabel } from "../lib/offline/occurrenceForm";
import {
  listPendingForSync,
  markConflict,
  markFailed,
  markPending,
  markPendingRetry,
  markSynced,
  markSyncing,
  type Occurrence,
} from "../lib/offline/occurrenceRepository";
import { ApiError, apiFetch } from "./api";

export type SyncResult = {
  sent: number;
  failed: number;
  conflicted: number;
  remaining: number;
  /** Motivo da parada antes do fim da fila (ex.: sem conexão). */
  stoppedBy: "network" | "timeout" | "server" | "unauthorized" | "config" | "session" | "backoff" | null;
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
 * machineId, eventType e message; os demais campos são ignorados por ele e já
 * seguem para quando o BE-06 aceitar o UUID estável da operação (idempotência).
 */
export function buildEventPayload(o: Occurrence) {
  const sector = o.sectorName ? `${o.sectorName} (${o.sectorId})` : o.sectorId;

  return {
    machineId: o.machineId,
    eventType: o.eventType,
    message:
      `${o.description}\n\n` +
      `Tipo: ${eventTypeLabel(o.eventType)} | Setor: ${sector} | ` +
      `Ocorrido em: ${o.occurredAt} | Ref. app: ${o.id}`,
    clientId: o.id,
    sectorId: o.sectorId,
    description: o.description,
    occurredAt: o.occurredAt,
  };
}

function isConflict(error: ApiError) {
  return error.code === "http" && (error.status === 409 || error.status === 412);
}

function isPermanentRejection(error: ApiError) {
  if (error.code !== "http" || error.status === undefined) return false;
  // 408 e 429 são temporários; conflitos têm estado próprio.
  return error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429 &&
    !isConflict(error);
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

async function runSync(
  userId: string,
  sessionToken: string,
  force: boolean
): Promise<SyncResult> {
  const queue = await listPendingForSync(userId);
  const result: SyncResult = {
    sent: 0,
    failed: 0,
    conflicted: 0,
    remaining: queue.length,
    stoppedBy: null,
  };

  for (const occurrence of queue) {
    // Não continue a fila de uma conta depois de logout ou troca de usuário.
    if (!(await isSameSession(userId, sessionToken))) {
      result.stoppedBy = "session";
      break;
    }

    const retryAt = occurrence.retryAfterAt ? Date.parse(occurrence.retryAfterAt) : 0;
    if (!force && retryAt > Date.now()) {
      result.stoppedBy = "backoff";
      break;
    }

    await markSyncing(occurrence.id);
    notifySyncChanged();

    // markSyncing pode aguardar o SQLite; confira de novo antes da requisição.
    if (!(await isSameSession(userId, sessionToken))) {
      await markPending(occurrence.id);
      result.stoppedBy = "session";
      notifySyncChanged();
      break;
    }

    try {
      const response = await apiFetch("/machine-events", {
        method: "POST",
        body: JSON.stringify(buildEventPayload(occurrence)),
        headers: { "Idempotency-Key": occurrence.id },
        authToken: sessionToken,
      });

      const serverId = typeof response?.id === "string" ? response.id : null;
      await markSynced(occurrence.id, serverId);
      result.sent += 1;
      result.remaining -= 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";

      if (error instanceof ApiError && isConflict(error)) {
        await markConflict(occurrence.id, message);
        result.conflicted += 1;
        result.remaining -= 1;
        continue;
      }

      if (error instanceof ApiError && isPermanentRejection(error)) {
        await markFailed(occurrence.id, message);
        result.failed += 1;
        result.remaining -= 1;
        continue;
      }

      // Falha temporária: as próximas também falhariam. Para e tenta depois.
      const retryState = await markPendingRetry(occurrence.id, message);
      if (retryState === "failed") {
        result.failed += 1;
        result.remaining -= 1;
      }
      result.stoppedBy = stopReason(error);
      break;
    } finally {
      notifySyncChanged();
    }
  }

  return result;
}

/** Envia a fila do usuário logado. Chamadas simultâneas compartilham a mesma execução. */
let running: Promise<SyncResult | null> | null = null;
let forceRequested = false;

export function syncPendingOccurrences(
  options: { force?: boolean } = {}
): Promise<SyncResult | null> {
  // Chamadas simultâneas compartilham o mesmo worker. Um pedido manual durante
  // o worker agenda uma passada forçada após a execução atual.
  if (running) {
    if (options.force) forceRequested = true;
    return running;
  }

  forceRequested = options.force === true;
  running = (async () => {
    let result: SyncResult | null = null;

    do {
      const force = forceRequested;
      forceRequested = false;

      const session = await getAuthSession();
      const userId = session?.user.id;
      result = userId ? await runSync(userId, session.token, force) : null;
    } while (forceRequested);

    return result;
  })().finally(() => {
    running = null;
    forceRequested = false;
  });

  return running;
}

/** Intervalo entre tentativas automáticas enquanto o app está aberto. */
export const AUTO_SYNC_INTERVAL_MS = 30 * 1000;

/** Tenta ao abrir/retomar o app, reconectar a rede e periodicamente como fallback. */
export function startAutoSync(): () => void {
  const trySync = (force = false) => {
    syncPendingOccurrences({ force }).catch(() => undefined);
  };

  trySync();
  const timer = setInterval(() => {
    if (AppState.currentState === "active") trySync();
  }, AUTO_SYNC_INTERVAL_MS);

  const appStateSubscription = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") trySync();
  });

  const networkSubscription = Network.addNetworkStateListener((state) => {
    if (state.isConnected === true && state.isInternetReachable !== false) {
      // A conexão voltou: não espere o backoff nem a próxima janela de 30 s.
      trySync(true);
    }
  });

  return () => {
    clearInterval(timer);
    appStateSubscription.remove();
    networkSubscription.remove();
  };
}
