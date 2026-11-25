// Regras de nova tentativa da fila offline. Ver docs/MATRIZ_CENARIOS_OFFLINE.md.

/** Primeira espera depois de uma falha temporária. */
export const BACKOFF_BASE_MS = 5 * 1000;

/** Espera máxima entre tentativas automáticas. */
export const BACKOFF_MAX_MS = 10 * 60 * 1000;

/**
 * Depois desta quantidade de falhas seguidas, a fila automática (timer e volta
 * ao app) para de tentar aquela ocorrência. Ela continua pendente e volta a ser
 * enviada na reconexão ou no "Sincronizar agora".
 */
export const MAX_AUTO_RETRIES = 6;

/** Espera antes da tentativa seguinte: 5 s, 10 s, 20 s, 40 s... até 10 min. */
export function nextAttemptDelay(retryCount: number): number {
  const exponent = Math.max(0, retryCount - 1);
  return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_MAX_MS);
}

export function isAutoRetryPaused(retryCount: number): boolean {
  return retryCount >= MAX_AUTO_RETRIES;
}
