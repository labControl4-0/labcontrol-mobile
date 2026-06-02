import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:8080/api";

export type AuthResponse = {
  id: string;
  name: string;
  email: string;
  token: string; 
};

// 🔥 request base
async function apiRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Erro na requisição";

    try {
      const errorData = await response.json();
      message = errorData.message || errorData.title || message;
    } catch {
      message = await response.text();
    }

    throw new Error(message);
  }

  return response.json();
}

// REGISTER
export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/Auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}
//ATUALIZAR DADOS DO USUÁRIO NA SESSÃO
export async function updateAuthSession(data: Partial<AuthResponse>) {
  const current = await getAuthSession();

  if (!current) return;

  const updated = { ...current, ...data };

  await AsyncStorage.setItem("user", JSON.stringify(updated));
}

// LOGIN
export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/Auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// SALVAR SESSÃO
export async function saveAuthSession(session: AuthResponse) {
  await AsyncStorage.setItem("user", JSON.stringify(session));
  await AsyncStorage.setItem("auth_token", session.token);
}

// PEGAR USER
export async function getAuthSession(): Promise<AuthResponse | null> {
  const data = await AsyncStorage.getItem("user");
  return data ? JSON.parse(data) : null;
}

// PEGAR TOKEN
export async function getAuthToken(): Promise<string | null> {
  return await AsyncStorage.getItem("auth_token");
}

//  LOGOUT
export async function logout() {
  await AsyncStorage.clear();
}

//  LIMPAR SESSÃO
export async function clearAuthSession() {
  await logout();
}