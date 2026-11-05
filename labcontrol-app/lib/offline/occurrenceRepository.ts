// Ocorrências de máquina gravadas no SQLite. A fila de envio é a própria
// tabela: tudo com sync_status = 'pending' ainda não chegou ao servidor.
// Estados e transições: docs/MATRIZ_CENARIOS_OFFLINE.md.
import * as Crypto from "expo-crypto";

import { getDatabase } from "./database";
import type { SyncStatus } from "./schema";
import { MAX_AUTO_RETRIES, nextAttemptDelay } from "./syncPolicy";

/** Versão da ocorrência que está no servidor, guardada quando há conflito. */
export type ServerVersion = {
  serverId: string | null;
  eventType: string | null;
  description: string | null;
  message: string | null;
  createdAt: string | null;
};

export type ConflictInfo = {
  reason: "content_mismatch" | "server_conflict";
  detectedAt: string;
  server: ServerVersion | null;
};

export type Occurrence = {
  id: string;
  userId: string;
  machineId: string;
  machineName: string;
  sectorId: string;
  sectorName: string | null;
  eventType: string;
  description: string;
  occurredAt: string;
  syncStatus: SyncStatus;
  attempts: number;
  /** Falhas temporárias seguidas desde o último sucesso. */
  retryCount: number;
  /** Quando a fila automática pode tentar de novo (ms desde 1970). */
  nextAttemptAt: number | null;
  /** Uma tentativa anterior pode ter chegado ao servidor: conferir antes de reenviar. */
  needsCheck: boolean;
  /** Aumenta a cada edição local. */
  localVersion: number;
  conflict: ConflictInfo | null;
  lastError: string | null;
  serverId: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
};

/** Campos que vêm do formulário. O resto é preenchido pelo repositório. */
export type NewOccurrence = {
  userId: string;
  machineId: string;
  machineName: string;
  sectorId: string;
  sectorName: string | null;
  eventType: string;
  description: string;
  occurredAt: string;
};

/** Campos que o usuário pode editar antes do envio. */
export type OccurrenceEdit = Pick<Occurrence, "eventType" | "description" | "occurredAt">;

type OccurrenceRow = {
  id: string;
  user_id: string;
  machine_id: string;
  machine_name: string;
  sector_id: string;
  sector_name: string | null;
  event_type: string;
  description: string;
  occurred_at: string;
  sync_status: SyncStatus;
  attempts: number;
  retry_count: number;
  next_attempt_at: number | null;
  needs_check: number;
  local_version: number;
  conflict_json: string | null;
  last_error: string | null;
  server_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

function parseConflict(json: string | null): ConflictInfo | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ConflictInfo;
  } catch {
    return null;
  }
}

function fromRow(row: OccurrenceRow): Occurrence {
  return {
    id: row.id,
    userId: row.user_id,
    machineId: row.machine_id,
    machineName: row.machine_name,
    sectorId: row.sector_id,
    sectorName: row.sector_name,
    eventType: row.event_type,
    description: row.description,
    occurredAt: row.occurred_at,
    syncStatus: row.sync_status,
    attempts: row.attempts,
    retryCount: row.retry_count,
    nextAttemptAt: row.next_attempt_at,
    needsCheck: row.needs_check === 1,
    localVersion: row.local_version,
    conflict: parseConflict(row.conflict_json),
    lastError: row.last_error,
    serverId: row.server_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
  };
}

const MAX_ERROR_LENGTH = 300;
const nowIso = () => new Date().toISOString();
const truncate = (text: string) => text.slice(0, MAX_ERROR_LENGTH);

/** Grava a ocorrência como pendente, com UUID v4 gerado no aparelho. */
export async function createOccurrence(input: NewOccurrence): Promise<Occurrence> {
  const db = await getDatabase();
  const now = nowIso();
  const id = Crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO occurrences (
       id, user_id, machine_id, machine_name, sector_id, sector_name,
       event_type, description, occurred_at, sync_status, attempts,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    [
      id,
      input.userId,
      input.machineId,
      input.machineName,
      input.sectorId,
      input.sectorName,
      input.eventType,
      input.description,
      input.occurredAt,
      now,
      now,
    ]
  );

  const created = await getOccurrence(input.userId, id);
  if (!created) throw new Error("Falha ao gravar a ocorrência no aparelho.");
  return created;
}

export async function getOccurrence(userId: string, id: string): Promise<Occurrence | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<OccurrenceRow>(
    "SELECT * FROM occurrences WHERE user_id = ? AND id = ?",
    [userId, id]
  );
  return row ? fromRow(row) : null;
}

/** Ocorrências do usuário, das mais novas para as mais antigas. */
export async function listOccurrences(userId: string): Promise<Occurrence[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OccurrenceRow>(
    "SELECT * FROM occurrences WHERE user_id = ? ORDER BY created_at DESC, id",
    [userId]
  );
  return rows.map(fromRow);
}

/**
 * Fila de envio, na ordem em que as ocorrências foram criadas.
 * Sem `force` (timer, volta ao app), respeita o backoff e o limite de
 * tentativas automáticas. Com `force` (reconexão, "Sincronizar agora"), envia
 * todas as pendentes.
 */
export async function listPendingForSync(
  userId: string,
  options: { force?: boolean; now?: number } = {}
): Promise<Occurrence[]> {
  const db = await getDatabase();
  const rows = options.force
    ? await db.getAllAsync<OccurrenceRow>(
        "SELECT * FROM occurrences WHERE user_id = ? AND sync_status = 'pending' ORDER BY created_at, id",
        [userId]
      )
    : await db.getAllAsync<OccurrenceRow>(
        `SELECT * FROM occurrences
          WHERE user_id = ? AND sync_status = 'pending'
            AND retry_count < ?
            AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
          ORDER BY created_at, id`,
        [userId, MAX_AUTO_RETRIES, options.now ?? Date.now()]
      );
  return rows.map(fromRow);
}

/** Quantas ocorrências ainda não chegaram ao servidor (pendentes, enviando, com erro ou em conflito). */
export async function countUnsynced(userId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM occurrences WHERE user_id = ? AND sync_status <> 'synced'",
    [userId]
  );
  return row?.total ?? 0;
}

/**
 * Reserva a ocorrência para envio. Retorna false se ela não estava mais
 * pendente (outra execução pegou, foi editada para outro estado ou sumiu).
 */
export async function markSyncing(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "UPDATE occurrences SET sync_status = 'syncing', updated_at = ? WHERE id = ? AND sync_status = 'pending'",
    [nowIso(), id]
  );
  return result.changes > 0;
}

/** Cancela uma tentativa antes do envio e deixa o registro na fila sem contar retry. */
export async function markPending(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE occurrences SET sync_status = 'pending', updated_at = ? WHERE id = ? AND sync_status = 'syncing'",
    [nowIso(), id]
  );
}

/** Só chamado depois de o servidor confirmar o recebimento (resposta 2xx ou evento encontrado). */
export async function markSynced(id: string, serverId: string | null): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'synced', server_id = ?, last_error = NULL, conflict_json = NULL,
           attempts = attempts + 1, retry_count = 0, next_attempt_at = NULL, needs_check = 0,
           synced_at = ?, updated_at = ?
     WHERE id = ?`,
    [serverId, now, now, id]
  );
}

/**
 * Falha temporária (sem rede, timeout, erro 5xx): continua pendente e espera o
 * backoff. `mayHaveReached` marca que o servidor pode ter gravado o evento.
 */
export async function markPendingRetry(
  id: string,
  error: string,
  options: { mayHaveReached: boolean; now?: number }
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ retry_count: number }>(
    "SELECT retry_count FROM occurrences WHERE id = ?",
    [id]
  );
  const retryCount = (row?.retry_count ?? 0) + 1;
  const nextAt = (options.now ?? Date.now()) + nextAttemptDelay(retryCount);

  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'pending', last_error = ?, attempts = attempts + 1,
           retry_count = ?, next_attempt_at = ?,
           needs_check = CASE WHEN ? = 1 THEN 1 ELSE needs_check END,
           updated_at = ?
     WHERE id = ?`,
    [truncate(error), retryCount, nextAt, options.mayHaveReached ? 1 : 0, nowIso(), id]
  );
}

/** Recusa definitiva do servidor (ex.: 400, 404): estado "erro" até o usuário pedir de novo. */
export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'failed', last_error = ?, attempts = attempts + 1,
           next_attempt_at = NULL, updated_at = ?
     WHERE id = ?`,
    [truncate(error), nowIso(), id]
  );
}

/** O servidor tem uma versão diferente: nada é sobrescrito até o usuário decidir. */
export async function markConflict(
  id: string,
  conflict: Omit<ConflictInfo, "detectedAt">,
  message: string
): Promise<void> {
  const db = await getDatabase();
  const info: ConflictInfo = { ...conflict, detectedAt: nowIso() };
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'conflict', conflict_json = ?, last_error = ?,
           server_id = COALESCE(?, server_id), attempts = attempts + 1,
           next_attempt_at = NULL, updated_at = ?
     WHERE id = ?`,
    [JSON.stringify(info), truncate(message), conflict.server?.serverId ?? null, nowIso(), id]
  );
}

/** O usuário pediu para tentar de novo uma ocorrência com erro. */
export async function requeueFailed(userId: string, id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'pending', retry_count = 0, next_attempt_at = NULL, updated_at = ?
     WHERE user_id = ? AND id = ? AND sync_status = 'failed'`,
    [nowIso(), userId, id]
  );
}

/**
 * Edição local antes do envio. Só vale para ocorrências pendentes ou com erro:
 * durante o envio, enviadas ou em conflito, retorna false e nada muda.
 */
export async function updateOccurrence(
  userId: string,
  id: string,
  edit: OccurrenceEdit
): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `UPDATE occurrences
       SET event_type = ?, description = ?, occurred_at = ?,
           local_version = local_version + 1,
           sync_status = 'pending', retry_count = 0, next_attempt_at = NULL, updated_at = ?
     WHERE user_id = ? AND id = ? AND sync_status IN ('pending', 'failed')`,
    [edit.eventType, edit.description, edit.occurredAt, nowIso(), userId, id]
  );
  return result.changes > 0;
}

/**
 * Resolução 1: aceitar a versão do servidor. Os campos locais passam a ser os
 * do servidor e a ocorrência fica como enviada. A versão local é descartada
 * por escolha explícita do usuário.
 */
export async function resolveConflictKeepServer(userId: string, id: string): Promise<boolean> {
  const current = await getOccurrence(userId, id);
  if (!current || current.syncStatus !== "conflict") return false;

  const server = current.conflict?.server;
  const db = await getDatabase();
  const now = nowIso();
  const result = await db.runAsync(
    `UPDATE occurrences
       SET event_type = ?, description = ?, sync_status = 'synced', conflict_json = NULL,
           last_error = NULL, needs_check = 0, retry_count = 0, next_attempt_at = NULL,
           server_id = COALESCE(?, server_id), synced_at = ?, updated_at = ?
     WHERE user_id = ? AND id = ? AND sync_status = 'conflict'`,
    [
      server?.eventType ?? current.eventType,
      server?.description ?? current.description,
      server?.serverId ?? null,
      now,
      now,
      userId,
      id,
    ]
  );
  return result.changes > 0;
}

/**
 * Resolução 2: manter as duas. O registro original passa a espelhar o que
 * está no servidor, e a versão local vira uma ocorrência nova (UUID novo),
 * pendente de envio. Nada é apagado nem sobrescrito no servidor.
 */
export async function resolveConflictKeepBoth(
  userId: string,
  id: string
): Promise<Occurrence | null> {
  const current = await getOccurrence(userId, id);
  if (!current || current.syncStatus !== "conflict") return null;

  const db = await getDatabase();
  let copy: Occurrence | null = null;

  await db.withTransactionAsync(async () => {
    const resolved = await resolveConflictKeepServer(userId, id);
    if (!resolved) return;
    copy = await createOccurrence({
      userId,
      machineId: current.machineId,
      machineName: current.machineName,
      sectorId: current.sectorId,
      sectorName: current.sectorName,
      eventType: current.eventType,
      description: current.description,
      occurredAt: current.occurredAt,
    });
  });

  return copy;
}

/** Logout: ocorrências já enviadas estão no servidor e podem sair do aparelho. */
export async function deleteSyncedOccurrences(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM occurrences WHERE sync_status = 'synced'");
}
