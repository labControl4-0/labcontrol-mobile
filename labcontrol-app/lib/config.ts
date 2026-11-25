// Configuração do cliente. Valores vêm de variáveis EXPO_PUBLIC_* (arquivo .env,
// não versionado). O acesso a process.env.EXPO_PUBLIC_* precisa ser literal para
// o Expo conseguir substituir o valor no build.

const DEFAULT_TIMEOUT_MS = 15000;

/** URL base da API sem barra final, ou null se não estiver configurada. */
export function getApiUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

/** Timeout padrão das requisições, em milissegundos. */
export function getApiTimeoutMs(): number {
  const value = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}
