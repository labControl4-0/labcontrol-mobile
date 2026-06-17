
import { getAuthToken } from "../lib/auth";

const API_URL = "http://ec2-3-222-252-59.compute-1.amazonaws.com/api";

console.log("API_URL usada:", API_URL);

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getAuthToken();

  const url = `${API_URL}${path}`;

  console.log("Chamando API:", url);

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    console.log("Erro API:", {
      url,
      status: response.status,
      data,
    });

    throw new Error(
      data?.message ||
        data?.error ||
        data?.title ||
        `Erro ${response.status} ao comunicar com o backend.`
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