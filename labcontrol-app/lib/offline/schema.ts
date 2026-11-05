// Schema SQLite versionado. Ver docs/SQLITE_SCHEMA.md.
//
// Cada item de MIGRATIONS leva o banco da versão N para N + 1. A versão atual
// fica em PRAGMA user_version. Nunca edite uma migração já publicada: crie outra.

export const SYNC_STATUSES = ["pending", "syncing", "synced", "failed", "conflict"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const MIGRATIONS: readonly string[] = [
  // v1 (MOB-03): ocorrências de máquina criadas no aparelho e cache de dados da API.
  `
  CREATE TABLE occurrences (
    id            TEXT PRIMARY KEY NOT NULL,
    user_id       TEXT NOT NULL,
    machine_id    TEXT NOT NULL,
    machine_name  TEXT NOT NULL,
    sector_id     TEXT NOT NULL,
    sector_name   TEXT,
    event_type    TEXT NOT NULL,
    description   TEXT NOT NULL,
    occurred_at   TEXT NOT NULL,
    sync_status   TEXT NOT NULL DEFAULT 'pending'
                  CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    server_id     TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    synced_at     TEXT
  );

  CREATE INDEX idx_occurrences_user_status
    ON occurrences (user_id, sync_status, created_at);

  CREATE TABLE cache_entries (
    user_id     TEXT NOT NULL,
    cache_key   TEXT NOT NULL,
    value_json  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, cache_key)
  );
  `,

  // v2 (MOB-04): estado "conflict", backoff e conferência antes de reenviar.
  // O SQLite não altera um CHECK existente, então a tabela é recriada.
  // Pendentes que já tiveram tentativa na v1 podem ter chegado ao servidor
  // (ex.: timeout depois de gravar): ficam marcadas para conferir antes do reenvio.
  `
  CREATE TABLE occurrences_v2 (
    id               TEXT PRIMARY KEY NOT NULL,
    user_id          TEXT NOT NULL,
    machine_id       TEXT NOT NULL,
    machine_name     TEXT NOT NULL,
    sector_id        TEXT NOT NULL,
    sector_name      TEXT,
    event_type       TEXT NOT NULL,
    description      TEXT NOT NULL,
    occurred_at      TEXT NOT NULL,
    sync_status      TEXT NOT NULL DEFAULT 'pending'
                     CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed', 'conflict')),
    attempts         INTEGER NOT NULL DEFAULT 0,
    retry_count      INTEGER NOT NULL DEFAULT 0,
    next_attempt_at  INTEGER,
    needs_check      INTEGER NOT NULL DEFAULT 0 CHECK (needs_check IN (0, 1)),
    local_version    INTEGER NOT NULL DEFAULT 1,
    conflict_json    TEXT,
    last_error       TEXT,
    server_id        TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    synced_at        TEXT
  );

  INSERT INTO occurrences_v2 (
    id, user_id, machine_id, machine_name, sector_id, sector_name, event_type,
    description, occurred_at, sync_status, attempts, needs_check, last_error,
    server_id, created_at, updated_at, synced_at
  )
  SELECT
    id, user_id, machine_id, machine_name, sector_id, sector_name, event_type,
    description, occurred_at, sync_status, attempts,
    CASE WHEN sync_status <> 'synced' AND (attempts > 0 OR sync_status = 'syncing') THEN 1 ELSE 0 END,
    last_error, server_id, created_at, updated_at, synced_at
  FROM occurrences;

  DROP TABLE occurrences;
  ALTER TABLE occurrences_v2 RENAME TO occurrences;

  CREATE INDEX idx_occurrences_user_status
    ON occurrences (user_id, sync_status, created_at);
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;
