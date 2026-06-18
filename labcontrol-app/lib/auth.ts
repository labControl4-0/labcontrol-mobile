import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "@labcontrol:session";
const TOKEN_KEY = "@labcontrol:token";



const API_URL = "http://ec2-3-222-252-59.compute-1.amazonaws.com/api";

export type AuthSession = {
  token?: string;
  accessToken?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
};

export async function login(
  email: string,
  password: string
): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/Auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      data?.title ||
      "E-mail ou senha inválidos."
    );
  }

  return data;
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/Auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      data?.title ||
      data ||
      "Erro ao criar conta."
    );
  }

  return data;
}

export async function saveAuthSession(session: AuthSession) {
  await AsyncStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session)
  );

  const token = session.token || session.accessToken;

  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const session = await AsyncStorage.getItem(SESSION_KEY);

  if (!session) {
    return null;
  }

  return JSON.parse(session);
}

export async function getAuthToken(): Promise<string | null> {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([
    SESSION_KEY,
    TOKEN_KEY,
  ]);
}
