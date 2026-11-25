// Cache local separado por usuário. Ver docs/POLITICA_DE_DADOS.md.
//
// Cada entrada fica em "@labcontrol:cache:<userId>:<chave>". A leitura só enxerga
// as chaves do usuário logado, então dados de outro usuário não aparecem mesmo
// que uma limpeza anterior tenha falhado. Toda entrada tem prazo de validade.
//
// Nunca grave credenciais aqui: no Android o AsyncStorage é um banco SQLite.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CACHE_PREFIX = "@labcontrol:cache:";

/** Prazo padrão de retenção de um dado em cache: 24 horas. */
export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

function userPrefix(userId: string) {
  if (!userId) throw new Error("userId obrigatório para usar o cache local.");
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}:`;
}

export function userCache(userId: string) {
  const prefix = userPrefix(userId);

  return {
    async set<T>(key: string, value: T, ttlMs: number = DEFAULT_CACHE_TTL_MS) {
      const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
      await AsyncStorage.setItem(prefix + key, JSON.stringify(entry));
    },

    async get<T>(key: string): Promise<T | null> {
      const raw = await AsyncStorage.getItem(prefix + key);
      if (!raw) return null;

      try {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        if (typeof entry.expiresAt === "number" && entry.expiresAt > Date.now()) {
          return entry.value;
        }
      } catch {
        // Entrada corrompida é tratada como expirada.
      }

      await AsyncStorage.removeItem(prefix + key);
      return null;
    },

    async remove(key: string) {
      await AsyncStorage.removeItem(prefix + key);
    },
  };
}

async function removeCacheKeys(filter: (key: string) => boolean) {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((k) => k.startsWith(CACHE_PREFIX) && filter(k));
  if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
}

/** Apaga o cache de todos os usuários (logout e sessão expirada). */
export function clearAllUserCaches() {
  return removeCacheKeys(() => true);
}

/** Apaga o cache de qualquer usuário diferente de `userId` (troca de usuário). */
export function clearOtherUsersCaches(userId: string) {
  const keep = userPrefix(userId);
  return removeCacheKeys((k) => !k.startsWith(keep));
}
