// Cache de dados da API no SQLite, separado por usuário e com prazo.
// Só dados operacionais da lista abaixo podem ser guardados (ver
// docs/POLITICA_DE_DADOS.md). Dados pessoais e credenciais não entram aqui.
import { getDatabase } from "./database";

/** Dados permitidos: plantas, máquinas por planta e setores por planta. */
const ALLOWED_KEYS = [/^plants$/, /^machines:[A-Za-z0-9-]+$/, /^sectors:[A-Za-z0-9-]+$/];

/** Prazo do cache de catálogo: 7 dias, para cobrir um fim de semana sem rede. */
export const CATALOG_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedValue<T> = {
  value: T;
  updatedAt: string;
};

function assertAllowedKey(key: string) {
  if (!ALLOWED_KEYS.some((pattern) => pattern.test(key))) {
    throw new Error(`Dado não permitido no cache offline: ${key}`);
  }
}

function assertUser(userId: string) {
  if (!userId) throw new Error("userId obrigatório para usar o cache offline.");
}

export async function putCache<T>(
  userId: string,
  key: string,
  value: T,
  ttlMs: number = CATALOG_CACHE_TTL_MS
): Promise<void> {
  assertUser(userId);
  assertAllowedKey(key);

  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO cache_entries (user_id, cache_key, value_json, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, key, JSON.stringify(value), new Date().toISOString(), Date.now() + ttlMs]
  );
}

export async function getCache<T>(userId: string, key: string): Promise<CachedValue<T> | null> {
  assertUser(userId);

  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    value_json: string;
    updated_at: string;
    expires_at: number;
  }>(
    "SELECT value_json, updated_at, expires_at FROM cache_entries WHERE user_id = ? AND cache_key = ?",
    [userId, key]
  );

  if (!row) return null;

  if (row.expires_at > Date.now()) {
    try {
      return { value: JSON.parse(row.value_json) as T, updatedAt: row.updated_at };
    } catch {
      // Valor corrompido é tratado como vencido.
    }
  }

  await db.runAsync("DELETE FROM cache_entries WHERE user_id = ? AND cache_key = ?", [userId, key]);
  return null;
}

/** Logout e sessão expirada: apaga o cache de todos os usuários. */
export async function clearAllCache(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM cache_entries");
}

/** Troca de usuário: apaga o cache de qualquer outra conta. */
export async function clearCacheExceptUser(userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM cache_entries WHERE user_id <> ?", [userId]);
}
