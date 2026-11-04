// Ocorrências de máquina gravadas no SQLite. A fila de envio é a própria
// tabela: tudo com sync_status = 'pending' ainda não chegou ao servidor.
import * as Crypto from "expo-crypto";

import { getDatabase } from "./database";
import type { SyncStatus } from "./schema";

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
  retryAfterAt: string | null;
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
  retry_after_at: string | null;
  last_error: string | null;
  server_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
};

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
    retryAfterAt: row.retry_after_at,
    lastError: row.last_error,
    serverId: row.server_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
  };
}

const MAX_ERROR_LENGTH = 300;
export const MAX_AUTOMATIC_SYNC_ATTEMPTS = 5;
export const RETRY_BASE_DELAY_MS = 5 * 1000;
export const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;
const nowIso = () => new Date().toISOString();

export function retryDelayForAttempt(attempt: number): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 30));
  return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** exponent);
}

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

/** Fila de envio, na ordem em que as ocorrências foram criadas. */
export async function listPendingForSync(userId: string): Promise<Occurrence[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OccurrenceRow>(
    "SELECT * FROM occurrences WHERE user_id = ? AND sync_status = 'pending' ORDER BY created_at, id",
    [userId]
  );
  return rows.map(fromRow);
}

/** Quantas ocorrências ainda não chegaram ao servidor (pendentes, enviando ou com falha). */
export async function countUnsynced(userId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM occurrences WHERE user_id = ? AND sync_status <> 'synced'",
    [userId]
  );
  return row?.total ?? 0;
}

export async function markSyncing(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE occurrences SET sync_status = 'syncing', updated_at = ? WHERE id = ? AND sync_status = 'pending'",
    [nowIso(), id]
  );
}

/** Cancela uma tentativa antes do envio e deixa o registro na fila sem contar retry. */
export async function markPending(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE occurrences SET sync_status = 'pending', updated_at = ? WHERE id = ? AND sync_status = 'syncing'",
    [nowIso(), id]
  );
}

/** Só chamado depois de o servidor confirmar o recebimento (resposta 2xx). */
export async function markSynced(id: string, serverId: string | null): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'synced', server_id = ?, last_error = NULL,
           retry_after_at = NULL, attempts = attempts + 1, synced_at = ?, updated_at = ?
     WHERE id = ?`,
    [serverId, now, now, id]
  );
}

/** Falha temporária: agenda retries exponenciais e limita o total de tentativas automáticas. */
export async function markPendingRetry(id: string, error: string): Promise<"pending" | "failed"> {
  const db = await getDatabase();
  const current = await db.getFirstAsync<{ attempts: number }>(
    "SELECT attempts FROM occurrences WHERE id = ? AND sync_status = 'syncing'",
    [id]
  );
  if (!current) return "pending";

  const attempts = current.attempts + 1;
  const exhausted = attempts >= MAX_AUTOMATIC_SYNC_ATTEMPTS;
  const retryAfterAt = exhausted
    ? null
    : new Date(Date.now() + retryDelayForAttempt(attempts)).toISOString();
  const status = exhausted ? "failed" : "pending";

  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = ?, last_error = ?, attempts = ?, retry_after_at = ?, updated_at = ?
     WHERE id = ? AND sync_status = 'syncing'`,
    [status, error.slice(0, MAX_ERROR_LENGTH), attempts, retryAfterAt, nowIso(), id]
  );
  return status;
}

/** Recusa definitiva do servidor (ex.: 400, 403, 404): sai da fila até retry manual. */
export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'failed', last_error = ?, retry_after_at = NULL,
           attempts = attempts + 1, updated_at = ?
     WHERE id = ?`,
    [error.slice(0, MAX_ERROR_LENGTH), nowIso(), id]
  );
}

/** Conflito do servidor: preserva o formulário local até o usuário decidir reenviar. */
export async function markConflict(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'conflict', last_error = ?, retry_after_at = NULL,
           attempts = attempts + 1, updated_at = ?
     WHERE id = ?`,
    [error.slice(0, MAX_ERROR_LENGTH), nowIso(), id]
  );
}

/** O usuário pediu para tentar de novo uma ocorrência com falha. */
export async function requeueFailed(userId: string, id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'pending', last_error = NULL, attempts = 0,
           retry_after_at = NULL, updated_at = ?
     WHERE user_id = ? AND id = ? AND sync_status = 'failed'`,
    [nowIso(), userId, id]
  );
}

/** O usuário revisou o conflito e pediu explicitamente uma nova tentativa. */
export async function requeueConflict(userId: string, id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE occurrences
       SET sync_status = 'pending', last_error = NULL, attempts = 0,
           retry_after_at = NULL, updated_at = ?
     WHERE user_id = ? AND id = ? AND sync_status = 'conflict'`,
    [nowIso(), userId, id]
  );
}

/** Logout: ocorrências já enviadas estão no servidor e podem sair do aparelho. */
export async function deleteSyncedOccurrences(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM occurrences WHERE sync_status = 'synced'");
}
