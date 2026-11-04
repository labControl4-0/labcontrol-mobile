// Armazenamento único da sessão. Todo o app lê e grava a sessão por aqui.
// Chamadas HTTP de login/registro ficam em services/authService.ts.
// Ver docs/POLITICA_DE_DADOS.md.
//
// - Token: armazenamento seguro (lib/secureStorage.ts). Nunca no AsyncStorage.
// - Perfil (id, nome, e-mail): AsyncStorage, sem o token.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearAllCache, clearCacheExceptUser } from "./offline/cacheStore";
import { deleteSyncedOccurrences } from "./offline/occurrenceRepository";
import { secretStore } from "./secureStorage";
import { clearAllUserCaches, clearOtherUsersCaches } from "./userCache";

// Limpeza do SQLite é "melhor esforço": se o banco falhar, login e logout
// continuam funcionando (a leitura já filtra por usuário).
const bestEffort = (task: () => Promise<void>) => task().catch(() => undefined);

const TOKEN_KEY = "labcontrol.auth.token";
const PROFILE_KEY = "@labcontrol:profile";

// Chaves de versões anteriores. "@labcontrol:session", "@labcontrol:token",
// "user" e "auth_token" guardavam credenciais no AsyncStorage;
// "profile_image_uri" não era separada por usuário. São apagadas ao gravar ou
// encerrar a sessão e na abertura do app.
export const LEGACY_KEYS = [
  "@labcontrol:session",
  "@labcontrol:token",
  "@labcontrol:user",
  "profile_image_uri",
  "user",
  "auth_token",
];

/** Remove dados de versões anteriores. Chamado na abertura do app. */
export async function purgeLegacyStorage(): Promise<void> {
  await AsyncStorage.multiRemove(LEGACY_KEYS);
}

export type AuthUser = {
  id?: string;
  name?: string;
  email?: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

/** Formatos aceitos na entrada: resposta plana do backend ou sessão já aninhada. */
export type AuthPayload = {
  token?: string;
  accessToken?: string;
  user?: AuthUser;
  id?: string;
  name?: string;
  email?: string;
};

function normalizeSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") return null;

  const payload = raw as AuthPayload;
  const token = payload.token ?? payload.accessToken;

  if (typeof token !== "string" || token.length === 0) return null;

  const source = payload.user ?? payload;
  const user: AuthUser = { id: source.id, name: source.name, email: source.email };

  return { token, user };
}

export async function saveAuthSession(payload: AuthPayload): Promise<AuthSession> {
  const session = normalizeSession(payload);

  if (!session) {
    throw new Error("Resposta de autenticação sem token.");
  }

  await secretStore.setItem(TOKEN_KEY, session.token);
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ user: session.user }));
  await AsyncStorage.multiRemove(LEGACY_KEYS);

  // Troca de usuário: o cache de outra conta não pode continuar no aparelho.
  const userId = session.user.id;
  if (userId) {
    await clearOtherUsersCaches(userId);
    await bestEffort(() => clearCacheExceptUser(userId));
  } else {
    await clearAllUserCaches();
    await bestEffort(clearAllCache);
  }

  return session;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const [token, storedProfile] = await Promise.all([
    secretStore.getItem(TOKEN_KEY),
    AsyncStorage.getItem(PROFILE_KEY),
  ]);

  if (!token && !storedProfile) return null;

  let user: AuthUser | null = null;

  try {
    const parsed = storedProfile ? JSON.parse(storedProfile) : null;
    if (parsed && typeof parsed.user === "object" && parsed.user) user = parsed.user;
  } catch {
    user = null;
  }

  // Sessão incompleta (ex.: aba web fechada apaga o token, mas o perfil fica)
  // ou corrompida: descarta tudo e o usuário volta ao login.
  if (!token || !user) {
    await clearAuthSession();
    return null;
  }

  return { token, user };
}

/** Token já resolvido (string) ou null. Nunca retorna Promise pendente para o chamador. */
export async function getAuthToken(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.token ?? null;
}

/**
 * Logout e sessão expirada: apaga token, perfil, todo o cache e as ocorrências
 * já enviadas. Ocorrências ainda não enviadas ficam no aparelho, visíveis só
 * para o próprio usuário, e são enviadas quando ele entrar de novo.
 */
export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    secretStore.removeItem(TOKEN_KEY),
    AsyncStorage.multiRemove([PROFILE_KEY, ...LEGACY_KEYS]),
    clearAllUserCaches(),
    bestEffort(clearAllCache),
    bestEffort(deleteSyncedOccurrences),
  ]);
}
