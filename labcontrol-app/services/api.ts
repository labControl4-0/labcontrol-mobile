import axios from "axios";

import { getToken } from "./tokenStorage";

export const API_BASE_URL = "http://localhost:8080";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const message =
        error.response.data?.message ||
        error.response.data?.title ||
        "Erro inesperado. Tente novamente.";
      return Promise.reject(new Error(message));
    }
    if (error.request) {
      return Promise.reject(
        new Error("Sem conexão com o servidor. Verifique a URL da API.")
      );
    }
    return Promise.reject(error);
  }
);
