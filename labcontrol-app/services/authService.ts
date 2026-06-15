import { apiFetch } from "./api";

export type AuthSession = {
  token?: string;
  accessToken?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  };
};

export type LoginData = {
  email: string;
  password: string;
};

export type RegisterData = {
  name: string;
  email: string;
  password: string;
};

export async function login(data: LoginData): Promise<AuthSession> {
  return apiFetch("/Auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: data.email,
      password: data.password,
    }),
  });
}

export async function register(data: RegisterData): Promise<AuthSession> {
  return apiFetch("/Auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      email: data.email,
      password: data.password,
    }),
  });
}