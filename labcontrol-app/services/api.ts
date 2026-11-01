import { clearAuthSession, getAuthToken } from "../lib/auth";
import { getApiTimeoutMs, getApiUrl } from "../lib/config";

export type ApiErrorCode =
  | "config"
  | "network"
  | "timeout"
  | "unauthorized"
  | "http";

/** Erro padrão de todas as requisições. `message` é sempre seguro para exibir ao usuário. */
export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;
  data?: unknown;

  constructor(
    message: string,
    code: ApiErrorCode,
    status?: number,
    data?: unknown
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export type ApiRequestOptions = RequestInit & {
  /** Não envia token nem trata 401 como sessão expirada (ex.: login e cadastro). */
  skipAuth?: boolean;
  /** Sobrescreve o timeout padrão, em milissegundos. */
  timeoutMs?: number;
};

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let unauthorizedInFlight: Promise<void> | null = null;

/**
 * Registra o que fazer quando a sessão expira (401): normalmente navegar para o login.
 * É chamado depois que a sessão local já foi limpa.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function handleUnauthorized(tokenSent: string | null): Promise<void> {
  // Várias requisições paralelas podem receber 401 juntas: trata uma vez só.
  if (unauthorizedInFlight) return unauthorizedInFlight;

  unauthorizedInFlight = (async () => {
    // Se a sessão mudou enquanto a requisição estava em voo (novo login),
    // o 401 é de uma sessão antiga e não deve derrubar a atual.
    const currentToken = await getAuthToken();
    if (currentToken !== tokenSent) return;

    await clearAuthSession();

    try {
      unauthorizedHandler?.();
    } catch {
      // Falha ao navegar não pode mascarar o erro 401 original.
    }
  })().finally(() => {
    unauthorizedInFlight = null;
  });

  return unauthorizedInFlight;
}

function parseBody(text: string): any {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractServerMessage(data: any): string | null {
  if (data && typeof data === "object") {
    for (const field of ["message", "error", "title"]) {
      if (typeof data[field] === "string" && data[field]) return data[field];
    }
    return null;
  }

  if (typeof data === "string" && data.length > 0 && data.length <= 200) {
    return data;
  }

  return null;
}

function buildHttpError(status: number, data: any, skipAuth: boolean): ApiError {
  if (status === 401) {
    const message = skipAuth
      ? extractServerMessage(data) ?? "E-mail ou senha inválidos."
      : "Sessão expirada. Faça login novamente.";

    return new ApiError(message, "unauthorized", status, data);
  }

  return new ApiError(
    extractServerMessage(data) ??
      `Erro ${status} ao comunicar com o backend.`,
    "http",
    status,
    data
  );
}

export async function apiFetch(
  path: string,
  options: ApiRequestOptions = {}
): Promise<any> {
  const {
    skipAuth = false,
    timeoutMs = getApiTimeoutMs(),
    signal: callerSignal,
    headers: rawHeaders,
    ...init
  } = options;

  const baseUrl = getApiUrl();

  if (!baseUrl) {
    throw new ApiError(
      "API não configurada. Defina EXPO_PUBLIC_API_URL no arquivo .env.",
      "config"
    );
  }

  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  // O token é resolvido aqui, antes de montar o header: o header recebe uma string.
  const token = skipAuth ? null : await getAuthToken();

  const headers = new Headers(rawHeaders);

  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  // Em FormData o fetch define o Content-Type com o boundary correto.
  if (init.body != null && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromCaller = () => controller.abort();

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", abortFromCaller);
  }

  let response: Response;
  let text: string;

  try {
    response = await fetch(url, { ...init, headers, signal: controller.signal });
    text = await response.text();
  } catch (error) {
    if (timedOut) {
      throw new ApiError(
        "O servidor demorou para responder. Tente novamente.",
        "timeout"
      );
    }

    // Cancelamento feito por quem chamou não é erro de rede.
    if (callerSignal?.aborted) throw error;

    throw new ApiError(
      "Não foi possível conectar ao servidor. Verifique sua conexão.",
      "network"
    );
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }

  const data = parseBody(text);

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      await handleUnauthorized(token);
    }

    throw buildHttpError(response.status, data, skipAuth);
  }

  return data;
}
