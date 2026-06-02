import { api } from "./api";
import { saveToken, saveUser } from "./tokenStorage";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from "../types/auth";

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>("/api/Auth/login", data);
  await saveToken(response.data.token);
  await saveUser({
    id: response.data.id,
    name: response.data.name,
    email: response.data.email,
  });
  return response.data;
}

export async function register(
  data: RegisterRequest
): Promise<RegisterResponse> {
  const response = await api.post<RegisterResponse>(
    "/api/Auth/register",
    data
  );
  return response.data;
}
