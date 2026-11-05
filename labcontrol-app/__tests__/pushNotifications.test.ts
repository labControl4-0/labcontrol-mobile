// MOB-05: permissão, canal, ExpoPushToken, registro no backend e notificação local.
// Dados sintéticos; o token abaixo não existe.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { clearAuthSession, saveAuthSession } from "../lib/auth";
import { getPushRegistration, maskPushToken } from "../lib/push/pushStore";
import { setUnauthorizedHandler } from "../services/api";
import {
  getPushStatus,
  setupPushNotifications,
  unregisterPushDevice,
} from "../services/pushRegistration";
import {
  API_URL,
  OTHER_TOKEN,
  OTHER_USER,
  TOKEN,
  USER,
  asyncStorageDump,
  mockFetch,
  resetStorage,
  secureStoreContents,
  sqliteFileDump,
} from "./testUtils";

const PUSH_TOKEN = "ExponentPushToken[sintetico-AbCdEf1234567890]";
const PROJECT_ID = "00000000-0000-4000-8000-00000000e45e";

// ─── Simulação do expo-notifications ──────────────────────────────────────────

type Perm = { granted: boolean; status: string; canAskAgain: boolean };
const GRANTED: Perm = { granted: true, status: "granted", canAskAgain: true };
const UNDETERMINED: Perm = { granted: false, status: "undetermined", canAskAgain: true };
const DENIED: Perm = { granted: false, status: "denied", canAskAgain: true };
const BLOCKED: Perm = { granted: false, status: "denied", canAskAgain: false };

const mockCalls: string[] = [];
const mockPerm: { current: Perm; answer: Perm } = { current: UNDETERMINED, answer: GRANTED };

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4, MAX: 5 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {
    mockCalls.push("channel");
  }),
  getPermissionsAsync: jest.fn(async () => {
    mockCalls.push("getPermissions");
    return mockPerm.current;
  }),
  requestPermissionsAsync: jest.fn(async () => {
    mockCalls.push("requestPermissions");
    mockPerm.current = mockPerm.answer;
    return mockPerm.current;
  }),
  getExpoPushTokenAsync: jest.fn(async () => {
    mockCalls.push("getToken");
    return { type: "expo", data: "ExponentPushToken[sintetico-AbCdEf1234567890]" };
  }),
  scheduleNotificationAsync: jest.fn(async () => "id-local"),
}));

const mockDevice = { isDevice: true };
jest.mock("expo-device", () => ({
  get isDevice() {
    return mockDevice.isDevice;
  },
}));

const mockConstants: { projectId: string | null } = { projectId: "00000000-0000-4000-8000-00000000e45e" };
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockConstants.projectId ? { eas: { projectId: mockConstants.projectId } } : {} };
    },
  },
}));

const Notifications = jest.requireMock("expo-notifications");

// ─── Preparação ───────────────────────────────────────────────────────────────

beforeEach(async () => {
  await resetStorage();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setUnauthorizedHandler(() => undefined);
  jest.replaceProperty(Platform, "OS", "android");
  mockCalls.length = 0;
  mockPerm.current = UNDETERMINED;
  mockPerm.answer = GRANTED;
  mockDevice.isDevice = true;
  mockConstants.projectId = PROJECT_ID;
  jest.clearAllMocks();
  await saveAuthSession({ token: TOKEN, ...USER });
});

afterEach(() => jest.restoreAllMocks());

const devicesPosts = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.filter(([url, init]) => url === `${API_URL}/devices` && init?.method === "POST");

// ─── Permissão ────────────────────────────────────────────────────────────────

describe("permissão", () => {
  it("cria o canal Android antes de pedir a permissão (exigência do Android 13+)", async () => {
    mockFetch({ status: 201, body: {} });

    await setupPushNotifications({ prompt: true });

    expect(mockCalls.indexOf("channel")).toBeGreaterThanOrEqual(0);
    expect(mockCalls.indexOf("channel")).toBeLessThan(mockCalls.indexOf("requestPermissions"));
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      "machine-alerts",
      expect.objectContaining({ name: "Alertas de máquinas", importance: 4 })
    );
  });

  it("negar a permissão não quebra: devolve o motivo, não gera token e não chama o servidor", async () => {
    mockPerm.answer = DENIED;
    const fetchMock = mockFetch();

    const result = await setupPushNotifications({ prompt: true });

    expect(result).toEqual({ status: "permission_denied", canAskAgain: true });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getPushRegistration()).toBeNull();
  });

  it("bloqueada de vez: não mostra o pedido de novo", async () => {
    mockPerm.current = BLOCKED;

    const result = await setupPushNotifications({ prompt: true });

    expect(result).toEqual({ status: "permission_denied", canAskAgain: false });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("na abertura do app (prompt: false) nunca mostra o pedido", async () => {
    const result = await setupPushNotifications({ prompt: false });

    expect(result).toEqual({ status: "permission_pending" });
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("erro nativo ao consultar a permissão vira 'não suportado', sem lançar", async () => {
    Notifications.getPermissionsAsync.mockRejectedValueOnce(new Error("módulo nativo ausente"));

    await expect(setupPushNotifications({ prompt: false })).resolves.toMatchObject({
      status: "unsupported",
    });
  });

  it("notificação local sem permissão devolve false em vez de lançar", async () => {
    mockPerm.current = DENIED;
    const { sendLocalTestNotification } = require("../lib/push/notifications");

    await expect(sendLocalTestNotification()).resolves.toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

// ─── Token e registro ─────────────────────────────────────────────────────────

describe("ExpoPushToken e registro do aparelho", () => {
  it("gera o token com o projectId do EAS e registra em POST /devices, autenticado", async () => {
    mockPerm.current = GRANTED;
    const fetchMock = mockFetch({ status: 201, body: { id: 1 } });

    const result = await setupPushNotifications({ prompt: true });

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: PROJECT_ID });
    expect(result).toEqual({
      status: "registered",
      maskedToken: maskPushToken(PUSH_TOKEN),
      alreadyRegistered: false,
    });

    const [post] = devicesPosts(fetchMock);
    expect(JSON.parse(post[1].body)).toEqual({ pushToken: PUSH_TOKEN, platform: "android" });
    expect(new Headers(post[1].headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("não registra de novo o mesmo token do mesmo usuário", async () => {
    mockPerm.current = GRANTED;
    mockFetch({ status: 201, body: {} });
    await setupPushNotifications({ prompt: false });

    const fetchMock = mockFetch();
    const result = await setupPushNotifications({ prompt: false });

    expect(result).toMatchObject({ status: "registered", alreadyRegistered: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("outro usuário no mesmo aparelho registra o token para ele", async () => {
    mockPerm.current = GRANTED;
    mockFetch({ status: 201, body: {} });
    await setupPushNotifications({ prompt: false });

    await saveAuthSession({ token: OTHER_TOKEN, ...OTHER_USER });
    const fetchMock = mockFetch({ status: 201, body: {} });
    await setupPushNotifications({ prompt: false });

    expect(devicesPosts(fetchMock)).toHaveLength(1);
    expect((await getPushRegistration())?.userId).toBe(OTHER_USER.id);
  });

  it("servidor sem a rota (404, BE-07 pendente): avisa e não marca como registrado", async () => {
    mockPerm.current = GRANTED;
    mockFetch({ status: 404, body: { message: "Not found" } });

    const result = await setupPushNotifications({ prompt: false });

    expect(result).toMatchObject({ status: "server_unavailable", message: expect.stringMatching(/BE-07/) });
    expect(await getPushRegistration()).toBeNull();
  });

  it("emulador: não pede token e explica o motivo", async () => {
    mockPerm.current = GRANTED;
    mockDevice.isDevice = false;
    const fetchMock = mockFetch();

    const result = await setupPushNotifications({ prompt: false });

    expect(result).toMatchObject({ status: "unsupported", message: expect.stringMatching(/aparelho físico/) });
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem projectId do EAS: orienta a rodar eas init", async () => {
    mockPerm.current = GRANTED;
    mockConstants.projectId = null;

    const result = await setupPushNotifications({ prompt: false });

    expect(result).toMatchObject({ status: "token_unavailable", message: expect.stringMatching(/eas-cli@latest init/) });
  });

  it("web não é suportada e não lança", async () => {
    jest.replaceProperty(Platform, "OS", "web");

    await expect(setupPushNotifications({ prompt: true })).resolves.toMatchObject({ status: "unsupported" });
  });

  it("sem sessão, não faz nada", async () => {
    await resetStorage();
    mockPerm.current = GRANTED;
    const fetchMock = mockFetch();

    expect(await setupPushNotifications({ prompt: true })).toEqual({ status: "no_session" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Proteção do token ────────────────────────────────────────────────────────

describe("proteção do token", () => {
  it("fica só no armazenamento seguro: nunca no AsyncStorage, no SQLite nem nos logs", async () => {
    mockPerm.current = GRANTED;
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      jest.spyOn(console, m).mockImplementation(() => undefined)
    );
    mockFetch({ status: 201, body: {} });

    await setupPushNotifications({ prompt: true });
    const status = await getPushStatus();

    expect([...secureStoreContents().values()].join()).toContain(PUSH_TOKEN);
    expect(await asyncStorageDump()).not.toContain("sintetico-AbCdEf");
    expect(sqliteFileDump()).not.toContain("sintetico-AbCdEf");
    expect(JSON.stringify(spies.flatMap((s) => s.mock.calls))).not.toContain("sintetico-AbCdEf");
    expect(status.maskedToken).toBe(maskPushToken(PUSH_TOKEN));
    expect(status.maskedToken).not.toContain("sintetico-AbCdEf");
  });

  it("a tela recebe o token mascarado", () => {
    expect(maskPushToken(PUSH_TOKEN)).toBe("ExponentPushToken[sint••••7890]");
    expect(maskPushToken("abc")).toBe("••••");
  });

  it("logout remove o aparelho no servidor e apaga o token local", async () => {
    mockPerm.current = GRANTED;
    mockFetch({ status: 201, body: {} });
    await setupPushNotifications({ prompt: true });

    const fetchMock = mockFetch({ status: 204 });
    await unregisterPushDevice();
    await clearAuthSession();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/devices/${encodeURIComponent(PUSH_TOKEN)}`);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(await getPushRegistration()).toBeNull();
    expect(secureStoreContents().size).toBe(0);
  });

  it("logout continua mesmo se o servidor não remover o aparelho", async () => {
    mockPerm.current = GRANTED;
    mockFetch({ status: 201, body: {} });
    await setupPushNotifications({ prompt: true });

    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed")) as never;
    await expect(unregisterPushDevice()).resolves.toBeUndefined();
    expect(await getPushRegistration()).toBeNull();
  });

  it("sessão expirada (401) também apaga o token local", async () => {
    mockPerm.current = GRANTED;
    mockFetch({ status: 201, body: {} });
    await setupPushNotifications({ prompt: true });

    await clearAuthSession();

    expect(await getPushRegistration()).toBeNull();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});

// ─── Registro em andamento x logout (revisão do PR #15) ───────────────────────

describe("registro em andamento durante o logout", () => {
  /** fetch que segura o POST /devices até release() e registra todas as chamadas. */
  function holdDevicePost() {
    let release: (status: number) => void = () => undefined;
    const seen: Array<{ url: string; method: string; auth: string | null }> = [];
    const fn = jest.fn((url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      seen.push({ url, method, auth: new Headers(init.headers).get("Authorization") });
      if (method === "POST" && url === `${API_URL}/devices`) {
        return new Promise((resolve) => {
          release = (status) => resolve({ ok: status < 300, status, text: async () => "" });
        });
      }
      return Promise.resolve({ ok: true, status: 204, text: async () => "" });
    });
    global.fetch = fn as never;
    return { seen, release: (status = 201) => release(status), started: () => seen.length > 0 };
  }

  const waitFor = async (cond: () => boolean) => {
    for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 5));
    expect(cond()).toBe(true);
  };

  it("logout espera o POST e remove o aparelho no servidor; nada fica salvo", async () => {
    mockPerm.current = GRANTED;
    const net = holdDevicePost();

    const registering = setupPushNotifications({ prompt: false });
    await waitFor(net.started);

    const loggingOut = (async () => {
      await unregisterPushDevice();
      await clearAuthSession();
    })();
    net.release(201);
    await Promise.all([registering, loggingOut]);

    expect(await registering).toEqual({ status: "no_session" });
    const del = net.seen.find((c) => c.method === "DELETE");
    expect(del?.url).toBe(`${API_URL}/devices/${encodeURIComponent(PUSH_TOKEN)}`);
    expect(del?.auth).toBe(`Bearer ${TOKEN}`);
    expect(await getPushRegistration()).toBeNull();
  });

  it("sessão encerrada sem passar pelo logout (ex.: 401) também desfaz o registro", async () => {
    mockPerm.current = GRANTED;
    const net = holdDevicePost();

    const registering = setupPushNotifications({ prompt: false });
    await waitFor(net.started);
    await clearAuthSession();
    net.release(201);

    expect(await registering).toEqual({ status: "no_session" });
    expect(net.seen.some((c) => c.method === "DELETE" && c.auth === `Bearer ${TOKEN}`)).toBe(true);
    expect(await getPushRegistration()).toBeNull();
  });

  it("troca de conta durante o POST: não grava o aparelho para o usuário novo", async () => {
    mockPerm.current = GRANTED;
    const net = holdDevicePost();

    const registering = setupPushNotifications({ prompt: false });
    await waitFor(net.started);
    await saveAuthSession({ token: OTHER_TOKEN, ...OTHER_USER });
    net.release(201);

    expect(await registering).toEqual({ status: "no_session" });
    expect(net.seen.find((c) => c.method === "DELETE")?.auth).toBe(`Bearer ${TOKEN}`);
    expect(await getPushRegistration()).toBeNull();
  });
});

// ─── Notificação local ────────────────────────────────────────────────────────

describe("notificação local", () => {
  it("é agendada no canal de alertas, com dados de origem", async () => {
    mockPerm.current = GRANTED;
    const { sendLocalTestNotification } = require("../lib/push/notifications");

    await expect(sendLocalTestNotification()).resolves.toBe(true);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        title: expect.stringContaining("teste local"),
        data: { origem: "local", categoria: "TESTE" },
      }),
      trigger: { channelId: "machine-alerts" },
    });
  });
});
