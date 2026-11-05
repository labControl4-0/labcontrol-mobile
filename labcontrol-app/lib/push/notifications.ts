// Notificações do aparelho com expo-notifications (aula "Expo e Java: Push
// Notification"). Ver docs/PUSH_NOTIFICATIONS.md.
//
// Regra: nenhuma função daqui lança erro para a tela. Permissão negada,
// emulador, web ou falta de projectId viram um resultado com o motivo.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Canal Android usado por todas as notificações do LabControl. */
export const ANDROID_CHANNEL_ID = "machine-alerts";
export const ANDROID_CHANNEL_NAME = "Alertas de máquinas";

export type PermissionState = {
  status: "granted" | "denied" | "undetermined" | "unsupported";
  /** false quando o sistema não mostra mais o pedido (usuário negou de vez). */
  canAskAgain: boolean;
};

// Os dois ramos declaram os mesmos campos: o projeto compila sem "strict", e
// sem isso o TypeScript não estreita a união pelo campo "ok".
export type TokenResult =
  | { ok: true; token: string; reason?: undefined; message?: undefined }
  | {
      ok: false;
      token?: undefined;
      reason:
        | "unsupported_platform"
        | "not_physical_device"
        | "permission_denied"
        | "missing_project_id"
        | "token_error";
      message: string;
    };

const isMobile = () => Platform.OS === "android" || Platform.OS === "ios";

let handlerInstalled = false;

/** Mostra a notificação mesmo com o app aberto. Chamado uma vez na abertura. */
export function installNotificationHandler(): void {
  if (handlerInstalled || !isMobile()) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Cria o canal Android. No Android 13+, o canal precisa existir antes do pedido
 * de permissão para o sistema mostrar a janela.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: ANDROID_CHANNEL_NAME,
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563EB",
  });
}

function toState(p: { granted: boolean; status: string; canAskAgain: boolean }): PermissionState {
  if (p.granted) return { status: "granted", canAskAgain: p.canAskAgain };
  const status = p.status === "undetermined" ? "undetermined" : "denied";
  return { status, canAskAgain: p.canAskAgain };
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!isMobile()) return { status: "unsupported", canAskAgain: false };
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch {
    return { status: "unsupported", canAskAgain: false };
  }
}

/**
 * Pede permissão só se ainda for possível. Se o usuário negou de vez, não
 * insiste: a tela oferece abrir as configurações do sistema.
 */
export async function requestPermission(): Promise<PermissionState> {
  if (!isMobile()) return { status: "unsupported", canAskAgain: false };
  try {
    await ensureAndroidChannel();
    const current = toState(await Notifications.getPermissionsAsync());
    if (current.status === "granted" || !current.canAskAgain) return current;
    return toState(await Notifications.requestPermissionsAsync());
  } catch {
    return { status: "unsupported", canAskAgain: false };
  }
}

/** projectId do EAS, gravado por `npx eas-cli@latest init`. */
export function getEasProjectId(): string | null {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;
  return fromConfig ?? fromEas ?? null;
}

/** Gera o ExpoPushToken. Exige aparelho físico, permissão e projectId do EAS. */
export async function getExpoPushToken(): Promise<TokenResult> {
  if (!isMobile()) {
    return { ok: false, reason: "unsupported_platform", message: "Push não é suportado nesta plataforma." };
  }
  if (!Device.isDevice) {
    return {
      ok: false,
      reason: "not_physical_device",
      message: "O push token só é gerado em um aparelho físico.",
    };
  }

  const permission = await getPermissionState();
  if (permission.status !== "granted") {
    return { ok: false, reason: "permission_denied", message: "Permissão de notificação não concedida." };
  }

  const projectId = getEasProjectId();
  if (!projectId) {
    return {
      ok: false,
      reason: "missing_project_id",
      message: 'Project ID do EAS não encontrado. Execute "npx eas-cli@latest init".',
    };
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: token.data };
  } catch {
    // A mensagem do erro nativo pode trazer dados do aparelho: não repassa.
    return { ok: false, reason: "token_error", message: "Não foi possível gerar o push token." };
  }
}

/** Notificação criada pelo próprio app, sem backend (aula 03). */
export async function sendLocalTestNotification(): Promise<boolean> {
  const permission = await getPermissionState();
  if (permission.status !== "granted") return false;

  try {
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "LabControl: teste local",
        body: "Esta notificação foi criada pelo próprio aplicativo.",
        data: { origem: "local", categoria: "TESTE" },
      },
      trigger: Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null,
    });
    return true;
  } catch {
    return false;
  }
}
