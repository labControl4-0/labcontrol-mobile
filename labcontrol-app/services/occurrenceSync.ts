// Envio da fila de ocorrências para POST /machine-events.
//
// Uma ocorrência só vira "synced" depois de uma resposta 2xx do servidor.
// Sem rede, timeout, 5xx ou 401: continua "pending" e é reenviada depois.
// Recusa definitiva (4xx): vira "failed" e espera o usuário pedir de novo.
import { AppState, type AppStateStatus } from "react-native";

import { getAuthSession } from "../lib/auth";
import { eventTypeLabel } from "../lib/offline/occurrenceForm";
import {
  listPendingForSync,
  markFailed,
  markPendingRetry,
  markSynced,
  markSyncing,
  type Occurrence,
} from "../lib/offline/occurrenceRepository";
import { ApiError, apiFetch } from "./api";

export type SyncResult = {
  sent: number;
  failed: number;
  remaining: number;
  /** Motivo da parada antes do fim da fila (ex.: sem conexão). */
  stoppedBy: "network" | "timeout" | "server" | "unauthorized" | "config" | null;
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
 * seguem para quando o BE-05 aceitar o UUID do aparelho (idempotência).
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

function isPermanentRejection(error: ApiError) {
  if (error.code !== "http" || error.status === undefined) return false;
  // 408 e 429 são temporários; o resto dos 4xx é recusa do conteúdo.
  return error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

function stopReason(error: unknown): SyncResult["stoppedBy"] {
  if (!(error instanceof ApiError)) return "network";
  if (error.code === "http") return "server";
  return error.code;
}

async function runSync(userId: string): Promise<SyncResult> {
  const queue = await listPendingForSync(userId);
  const result: SyncResult = { sent: 0, failed: 0, remaining: queue.length, stoppedBy: null };

  for (const occurrence of queue) {
    await markSyncing(occurrence.id);
    notifySyncChanged();

    try {
      const response = await apiFetch("/machine-events", {
        method: "POST",
        body: JSON.stringify(buildEventPayload(occurrence)),
      });

      const serverId = typeof response?.id === "string" ? response.id : null;
      await markSynced(occurrence.id, serverId);
      result.sent += 1;
      result.remaining -= 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";

      if (error instanceof ApiError && isPermanentRejection(error)) {
        await markFailed(occurrence.id, message);
        result.failed += 1;
        result.remaining -= 1;
        continue;
      }

      // Falha temporária: as próximas também falhariam. Para e tenta depois.
      await markPendingRetry(occurrence.id, message);
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

export function syncPendingOccurrences(): Promise<SyncResult | null> {
  // A trava é registrada antes de qualquer await: outra chamada no mesmo
  // instante reaproveita esta execução em vez de enviar de novo.
  if (running) return running;

  running = (async () => {
    const session = await getAuthSession();
    const userId = session?.user.id;
    return userId ? runSync(userId) : null;
  })().finally(() => {
    running = null;
  });

  return running;
}

/** Intervalo entre tentativas automáticas enquanto o app está aberto. */
export const AUTO_SYNC_INTERVAL_MS = 30 * 1000;

/** Tenta enviar ao abrir o app, ao voltar para ele e a cada 30 s. Retorna a função de parada. */
export function startAutoSync(): () => void {
  const trySync = () => {
    syncPendingOccurrences().catch(() => undefined);
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
