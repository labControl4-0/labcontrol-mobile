import { Platform } from "react-native";
import { getToken } from "./tokenStorage";
import { getAuthToken } from "../lib/auth";

const LOCAL_IP = "192.168.1.6"; // IP do seu computador na rede Wi-Fi
const IS_EMULATOR = false; // true = emulador Android, false = dispositivo físico

export const API_URL =
  Platform.OS === "web"
    ? "http://localhost:8080/api"
    : Platform.OS === "android" && IS_EMULATOR
    ? "http://10.0.2.2:8080/api"
    : `http://${LOCAL_IP}:8080/api`;

export async function apiFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      data?.title ||
      "Erro na requisição."
    );
  }

  return data;
}

export async function apiFetchAuth(path: string, options: RequestInit = {}) {
  // AsyncStorage (mobile) first, then localStorage (web)
  const token = (await getToken()) ?? getAuthToken();
  return apiFetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}