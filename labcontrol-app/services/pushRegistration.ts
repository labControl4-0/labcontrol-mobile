// Registro do aparelho na API do LabControl (ASP.NET Core):
// POST /api/devices { pushToken, platform }, o mesmo formato usado na aula.
// A requisição vai autenticada, para a API associar o token ao usuário (BE-07).
import { Platform } from "react-native";

import { getAuthSession } from "../lib/auth";
import {
  getExpoPushToken,
  getPermissionState,
  requestPermission,
  type PermissionState,
} from "../lib/push/notifications";
import {
  clearPushRegistration,
  getPushRegistration,
  maskPushToken,
  savePushRegistration,
} from "../lib/push/pushStore";
import { ApiError, apiFetch } from "./api";

export type PushSetupResult =
  | { status: "registered"; maskedToken: string; alreadyRegistered: boolean }
  | { status: "permission_denied"; canAskAgain: boolean }
  | { status: "permission_pending" }
  | { status: "unsupported"; message: string }
  | { status: "token_unavailable"; message: string }
  | { status: "no_session" }
  | { status: "server_unavailable"; message: string; maskedToken: string };

function deviceBody(pushToken: string) {
  return JSON.stringify({ pushToken, platform: Platform.OS });
}

const devicePath = (pushToken: string) => `/devices/${encodeURIComponent(pushToken)}`;

// Coordenação entre registro e logout. Um registro pode estar esperando a
// resposta do POST quando o usuário sai da conta (ex.: o registro silencioso
// disparado logo após o login). Cada logout aumenta a "geração"; um registro
// que termina numa geração antiga, ou com outra sessão, desfaz o que fez no
// servidor em vez de gravar o aparelho para uma conta que já saiu.
let registrationGeneration = 0;
const inFlight = new Set<Promise<unknown>>();

/** Espera máxima do logout por um registro em andamento (ex.: janela de permissão aberta). */
const LOGOUT_WAIT_MS = 20 * 1000;

/**
 * Ativa as notificações deste aparelho.
 * - `prompt: true` (toque do usuário): pode mostrar o pedido de permissão.
 * - `prompt: false` (abertura do app): só registra se a permissão já existir.
 * - `force: true`: registra de novo mesmo se já estiver registrado.
 */
export function setupPushNotifications(
  options: { prompt?: boolean; force?: boolean } = {}
): Promise<PushSetupResult> {
  const run = runSetup(options);
  inFlight.add(run);
  run.finally(() => inFlight.delete(run)).catch(() => undefined);
  return run;
}

async function runSetup(options: { prompt?: boolean; force?: boolean }): Promise<PushSetupResult> {
  const generation = registrationGeneration;
  const session = await getAuthSession();
  const userId = session?.user.id;
  if (!userId || !session) return { status: "no_session" };
  // A credencial fica fixa: a resposta pode chegar depois de logout ou troca de conta.
  const sessionToken = session.token;

  const permission: PermissionState = options.prompt
    ? await requestPermission()
    : await getPermissionState();

  if (permission.status === "unsupported") {
    return { status: "unsupported", message: "Notificações não são suportadas aqui." };
  }
  if (permission.status === "undetermined") return { status: "permission_pending" };
  if (permission.status !== "granted") {
    return { status: "permission_denied", canAskAgain: permission.canAskAgain };
  }

  const token = await getExpoPushToken();
  if (!token.ok) {
    return token.reason === "unsupported_platform" || token.reason === "not_physical_device"
      ? { status: "unsupported", message: token.message }
      : { status: "token_unavailable", message: token.message };
  }

  if (!token.token) return { status: "token_unavailable", message: "Push token vazio." };
  const maskedToken = maskPushToken(token.token);
  const stored = await getPushRegistration();
  if (!options.force && stored?.pushToken === token.token && stored.userId === userId) {
    return { status: "registered", maskedToken, alreadyRegistered: true };
  }

  if (generation !== registrationGeneration) return { status: "no_session" };

  try {
    await apiFetch("/devices", {
      method: "POST",
      body: deviceBody(token.token),
      authToken: sessionToken,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "unauthorized") return { status: "no_session" };
    const message =
      error instanceof ApiError && error.status === 404
        ? "O servidor ainda não tem a rota de registro de dispositivos (BE-07)."
        : error instanceof Error
          ? error.message
          : "Erro ao registrar o aparelho.";
    return { status: "server_unavailable", message, maskedToken };
  }

  // O POST terminou. Se houve logout, sessão expirada ou troca de conta nesse
  // meio-tempo, desfaz no servidor com a mesma credencial e não grava nada.
  const current = await getAuthSession().catch(() => null);
  const stillSameSession =
    generation === registrationGeneration &&
    current?.user.id === userId &&
    current.token === sessionToken;

  if (!stillSameSession) {
    await apiFetch(devicePath(token.token), { method: "DELETE", authToken: sessionToken }).catch(
      () => undefined
    );
    return { status: "no_session" };
  }

  await savePushRegistration({ pushToken: token.token, userId, registeredAt: new Date().toISOString() });
  return { status: "registered", maskedToken, alreadyRegistered: false };
}

/**
 * Logout: pede ao backend para remover este aparelho do usuário e apaga o
 * registro local. Falha no servidor não impede o logout.
 * Chame ANTES de clearAuthSession(), enquanto a sessão ainda vale.
 */
export async function unregisterPushDevice(): Promise<void> {
  // Registros em andamento passam a ser de uma geração antiga: ao terminar,
  // eles mesmos removem o aparelho no servidor. O logout espera por eles
  // (limitado pelo timeout das requisições) para a remoção usar a sessão válida.
  registrationGeneration += 1;
  await Promise.race([
    Promise.allSettled([...inFlight]),
    new Promise((resolve) => setTimeout(resolve, LOGOUT_WAIT_MS)),
  ]);

  const stored = await getPushRegistration();
  if (stored) {
    await apiFetch(devicePath(stored.pushToken), { method: "DELETE" }).catch(() => undefined);
  }
  await clearPushRegistration();
}

/** Estado atual para a tela, sem pedir permissão nem chamar o servidor. */
export async function getPushStatus(): Promise<{
  permission: PermissionState;
  maskedToken: string | null;
}> {
  const [permission, stored, session] = await Promise.all([
    getPermissionState(),
    getPushRegistration(),
    getAuthSession(),
  ]);
  const mine = stored && stored.userId === session?.user.id ? stored : null;
  return { permission, maskedToken: mine ? maskPushToken(mine.pushToken) : null };
}
