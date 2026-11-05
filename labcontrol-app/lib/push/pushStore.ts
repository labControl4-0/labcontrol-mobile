// Registro do push token deste aparelho. Ver docs/PUSH_NOTIFICATIONS.md.
//
// O ExpoPushToken é um endereço de entrega: quem tiver o token consegue mandar
// notificações para este aparelho. Por isso ele fica no armazenamento seguro
// (SecureStore no Android/iOS), nunca no AsyncStorage, no SQLite ou nos logs.
import { secretStore } from "../secureStorage";

const PUSH_REGISTRATION_KEY = "labcontrol.push.registration";

export type PushRegistration = {
  pushToken: string;
  userId: string;
  registeredAt: string;
};

export async function getPushRegistration(): Promise<PushRegistration | null> {
  const raw = await secretStore.getItem(PUSH_REGISTRATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PushRegistration;
    return typeof parsed.pushToken === "string" && typeof parsed.userId === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function savePushRegistration(registration: PushRegistration): Promise<void> {
  await secretStore.setItem(PUSH_REGISTRATION_KEY, JSON.stringify(registration));
}

export async function clearPushRegistration(): Promise<void> {
  await secretStore.removeItem(PUSH_REGISTRATION_KEY);
}

/** Mostra só o começo e o fim do token, para a tela e para evidências. */
export function maskPushToken(token: string): string {
  const match = /^(ExponentPushToken|ExpoPushToken)\[(.+)\]$/.exec(token);
  const prefix = match ? `${match[1]}[` : "";
  const inner = match ? match[2] : token;
  const suffix = match ? "]" : "";
  if (inner.length <= 8) return `${prefix}••••${suffix}`;
  return `${prefix}${inner.slice(0, 4)}••••${inner.slice(-4)}${suffix}`;
}
