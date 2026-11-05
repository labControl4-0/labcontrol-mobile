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

/**
 * Ativa as notificações deste aparelho.
 * - `prompt: true` (toque do usuário): pode mostrar o pedido de permissão.
 * - `prompt: false` (abertura do app): só registra se a permissão já existir.
 * - `force: true`: registra de novo mesmo se já estiver registrado.
 */
export async function setupPushNotifications(
  options: { prompt?: boolean; force?: boolean } = {}
): Promise<PushSetupResult> {
  const session = await getAuthSession();
  const userId = session?.user.id;
  if (!userId) return { status: "no_session" };

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

  try {
    await apiFetch("/devices", { method: "POST", body: deviceBody(token.token) });
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

  await savePushRegistration({ pushToken: token.token, userId, registeredAt: new Date().toISOString() });
  return { status: "registered", maskedToken, alreadyRegistered: false };
}

/**
 * Logout: pede ao backend para remover este aparelho do usuário e apaga o
 * registro local. Falha no servidor não impede o logout.
 */
export async function unregisterPushDevice(): Promise<void> {
  const stored = await getPushRegistration();
  if (stored) {
    await apiFetch(`/devices/${encodeURIComponent(stored.pushToken)}`, { method: "DELETE" }).catch(
      () => undefined
    );
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
