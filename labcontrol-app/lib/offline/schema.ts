// Schema SQLite versionado. Ver docs/SQLITE_SCHEMA.md.
//
// Cada item de MIGRATIONS leva o banco da versão N para N + 1. A versão atual
// fica em PRAGMA user_version. Nunca edite uma migração já publicada: crie outra.

export const SYNC_STATUSES = ["pending", "syncing", "synced", "failed"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const MIGRATIONS: readonly string[] = [
  // v1: ocorrências de máquina criadas no aparelho e cache de dados da API.
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
];

export const SCHEMA_VERSION = MIGRATIONS.length;
