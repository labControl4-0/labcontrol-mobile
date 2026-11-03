// Único ponto do app que abre o SQLite. Ver docs/SQLITE_SCHEMA.md.
//
// Este banco guarda só dados de cache e ocorrências. Credenciais nunca entram
// aqui (regra 1 da docs/POLITICA_DE_DADOS.md).
import * as SQLite from "expo-sqlite";

import { MIGRATIONS, SCHEMA_VERSION } from "./schema";

export const DATABASE_NAME = "labcontrol.db";

/** Ocorrências já sincronizadas ficam no aparelho por 30 dias. */
export const SYNCED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type Database = SQLite.SQLiteDatabase;

let databasePromise: Promise<Database> | null = null;

async function migrate(db: Database) {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let version = row?.user_version ?? 0;

  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Banco local na versão ${version}, mas o app conhece até a ${SCHEMA_VERSION}.`
    );
  }

  while (version < SCHEMA_VERSION) {
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

async function runStartupMaintenance(db: Database) {
  // Um envio interrompido (app fechado no meio) volta para a fila.
  await db.runAsync(
    "UPDATE occurrences SET sync_status = 'pending', updated_at = ? WHERE sync_status = 'syncing'",
    [new Date().toISOString()]
  );

  const cutoff = new Date(Date.now() - SYNCED_RETENTION_MS).toISOString();
  await db.runAsync(
    "DELETE FROM occurrences WHERE sync_status = 'synced' AND synced_at < ?",
    [cutoff]
  );

  await db.runAsync("DELETE FROM cache_entries WHERE expires_at <= ?", [Date.now()]);
}

async function openAndPrepare(): Promise<Database> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  await migrate(db);
  await runStartupMaintenance(db);
  return db;
}

/** Banco aberto e migrado. Abre uma vez só e reaproveita a conexão. */
export function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = openAndPrepare().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

/** Fecha a conexão. A próxima chamada a getDatabase() reabre o arquivo. */
export async function closeDatabase(): Promise<void> {
  const pending = databasePromise;
  databasePromise = null;
  const db = await pending?.catch(() => null);
  await db?.closeAsync();
}

/**
 * Esquece a conexão sem fechá-la. Usado nos testes para simular o sistema
 * encerrando o app de repente, sem chance de fechar o banco.
 */
export function forgetDatabaseConnection(): void {
  databasePromise = null;
}
