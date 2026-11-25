import { apiFetch } from "./api";
import { saveAuthSession, type AuthPayload, type AuthSession } from "../lib/auth";

export type LoginData = {
  email: string;
  password: string;
};

export type RegisterData = {
  name: string;
  email: string;
  password: string;
};

/** Autentica e persiste a sessão. Retorna a sessão já normalizada. */
export async function login(data: LoginData): Promise<AuthSession> {
  const payload: AuthPayload = await apiFetch("/Auth/login", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      email: data.email,
      password: data.password,
    }),
  });

  return saveAuthSession(payload);
}

export async function register(data: RegisterData) {
  return apiFetch("/Auth/register", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
    }),
  });
}
