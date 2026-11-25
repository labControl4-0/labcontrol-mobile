// Plantas, máquinas e setores com cache offline no SQLite.
//
// Tenta a API primeiro. Se não houver rede, der timeout ou o servidor estiver
// com erro (5xx), usa a última cópia salva do usuário. 401 e erros de
// configuração não usam cache: a sessão é encerrada pelo services/api.ts.
import { getAuthSession } from "../lib/auth";
import { getCache, putCache } from "../lib/offline/cacheStore";
import type { Machine, Sector } from "../types/blueprint";
import type { Plant } from "../types/plant";
import { ApiError, apiFetch } from "./api";

export type CachedResult<T> = {
  data: T;
  source: "network" | "cache";
  /** Data da cópia em cache (ISO). Só quando source = "cache". */
  cachedAt?: string;
};

function canUseCache(error: unknown) {
  if (!(error instanceof ApiError)) return true;
  if (error.code === "network" || error.code === "timeout") return true;
  return error.code === "http" && (error.status ?? 0) >= 500;
}

async function requireUserId() {
  const session = await getAuthSession();
  const userId = session?.user.id;
  if (!userId) {
    throw new ApiError("Sessão expirada. Faça login novamente.", "unauthorized", 401);
  }
  return userId;
}

export async function fetchWithCache<T>(cacheKey: string, path: string): Promise<CachedResult<T>> {
  const userId = await requireUserId();

  try {
    const data = (await apiFetch(path)) as T;
    // Falha ao gravar o cache não pode esconder dados que chegaram da API.
    await putCache(userId, cacheKey, data).catch(() => undefined);
    return { data, source: "network" };
  } catch (error) {
    if (!canUseCache(error)) throw error;

    const cached = await getCache<T>(userId, cacheKey).catch(() => null);
    if (!cached) throw error;

    return { data: cached.value, source: "cache", cachedAt: cached.updatedAt };
  }
}

export function getPlantsCached() {
  return fetchWithCache<Plant[]>("plants", "/plants");
}

export function getMachinesByPlantCached(plantId: string) {
  return fetchWithCache<Machine[]>(`machines:${plantId}`, `/machines/plant/${plantId}`);
}

export function getSectorsByPlantCached(plantId: string) {
  return fetchWithCache<Omit<Sector, "points">[]>(`sectors:${plantId}`, `/sectors/plant/${plantId}`);
}
