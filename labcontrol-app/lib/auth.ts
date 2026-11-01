// Armazenamento único da sessão. Todo o app lê e grava a sessão por aqui.
// Chamadas HTTP de login/registro ficam em services/authService.ts.
import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "@labcontrol:session";

// Chaves usadas por versões anteriores (lib/auth.ts e tokenStorage.ts).
// Só são removidas no logout, para não deixar token antigo no aparelho.
const LEGACY_KEYS = ["@labcontrol:token", "@labcontrol:user"];

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

  const user: AuthUser = payload.user ?? {
    id: payload.id,
    name: payload.name,
    email: payload.email,
  };

  return { token, user };
}

export async function saveAuthSession(payload: AuthPayload): Promise<AuthSession> {
  const session = normalizeSession(payload);

  if (!session) {
    throw new Error("Resposta de autenticação sem token.");
  }

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));

  return session;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const stored = await AsyncStorage.getItem(SESSION_KEY);

  if (!stored) return null;

  try {
    return normalizeSession(JSON.parse(stored));
  } catch {
    // Valor corrompido: descarta para o usuário voltar ao login.
    await clearAuthSession();
    return null;
  }
}

/** Token já resolvido (string) ou null. Nunca retorna Promise pendente para o chamador. */
export async function getAuthToken(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.token ?? null;
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([SESSION_KEY, ...LEGACY_KEYS]);
}
