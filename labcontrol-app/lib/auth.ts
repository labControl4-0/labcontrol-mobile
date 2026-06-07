const API_URL = "http://localhost:8080/api";

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
  localStorage.setItem("labcontrol_session", JSON.stringify(session));

  const token = session.token || session.accessToken;

  if (token) {
    localStorage.setItem("labcontrol_token", token);
  }
}

export function getAuthSession(): AuthSession | null {
  const session = localStorage.getItem("labcontrol_session");

  if (!session) {
    return null;
  }

  return JSON.parse(session);
}

export function getAuthToken(): string | null {
  return localStorage.getItem("labcontrol_token");
}

export function clearAuthSession() {
  localStorage.removeItem("labcontrol_session");
  localStorage.removeItem("labcontrol_token");
}