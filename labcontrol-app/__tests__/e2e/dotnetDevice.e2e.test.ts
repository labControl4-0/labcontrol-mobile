/**
 * @jest-environment node
 */
// MOB-05: registro do aparelho contra a API real do LabControl (ASP.NET Core +
// Postgres). Usa o código real do app; só o módulo nativo de notificações é
// simulado, com um token SINTÉTICO (o ExpoPushToken real só existe no aparelho).
//
// Hoje a API não tem POST /api/devices (BE-07). O teste comprova que o app
// autentica, chama a rota e NÃO trata o aparelho como registrado. Quando o
// BE-07 entrar, troque a expectativa para "registered" (ver docs/PUSH_NOTIFICATIONS.md).
//
// Fica desligado em `npm test`. Variáveis: E2E_API_DLL e E2E_DB_CONNECTION
// (as mesmas de backendSync.e2e.test.ts) e E2E_API_PORT (padrão 5082).
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { Platform } from "react-native";

import { getAuthSession } from "../../lib/auth";
import { getPushRegistration } from "../../lib/push/pushStore";
import { login } from "../../services/authService";
import { setupPushNotifications, unregisterPushDevice } from "../../services/pushRegistration";
import { resetStorage } from "../testUtils";

const DLL = process.env.E2E_API_DLL;
const DB = process.env.E2E_DB_CONNECTION;
const PORT = Number(process.env.E2E_API_PORT ?? 5082);
const API = `http://127.0.0.1:${PORT}/api`;
const describeE2E = DLL && DB ? describe : describe.skip;

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: "granted", canAskAgain: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: "expo", data: "ExponentPushToken[e2e-sintetico-dotnet]" })),
  scheduleNotificationAsync: jest.fn(),
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "00000000-0000-4000-8000-00000000e2e0" } } } },
}));

let api: ChildProcess | null = null;
const log: string[] = [];

async function isUp() {
  try {
    return (await fetch(`${API}/plants`)).status === 401;
  } catch {
    return false;
  }
}

describeE2E("E2E: registro do aparelho na API .NET", () => {
  jest.setTimeout(180_000);

  beforeAll(async () => {
    await resetStorage();
    jest.replaceProperty(Platform, "OS", "android");
    process.env.EXPO_PUBLIC_API_URL = API;

    api = spawn("dotnet", [DLL!], {
      cwd: path.dirname(DLL!),
      env: {
        ...process.env,
        ASPNETCORE_URLS: `http://127.0.0.1:${PORT}`,
        ASPNETCORE_ENVIRONMENT: "Development",
        ConnectionStrings__DefaultConnection: DB!,
        Mqtt__Host: "127.0.0.1",
        Mqtt__Port: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    api.stdout?.on("data", (d) => log.push(String(d)));
    api.stderr?.on("data", (d) => log.push(String(d)));

    const deadline = Date.now() + 90_000;
    while (!(await isUp())) {
      if (Date.now() > deadline || api.exitCode !== null) {
        throw new Error(`API não subiu.\n${log.slice(-20).join("")}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    const email = `push-e2e-${Date.now()}@example.test`;
    const res = await fetch(`${API}/Auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Usuária Push E2E", email, password: "senha-e2e-123" }),
    });
    expect(res.ok).toBe(true);
    await login({ email, password: "senha-e2e-123" });
  });

  afterAll(async () => {
    if (api && api.exitCode === null) {
      const exited = new Promise((r) => api!.once("exit", r));
      api.kill();
      await exited;
    }
  });

  it("sem a rota do BE-07, o app avisa e não marca o aparelho como registrado", async () => {
    const result = await setupPushNotifications({ prompt: true });

    expect(result).toMatchObject({
      status: "server_unavailable",
      message: expect.stringMatching(/BE-07/),
      maskedToken: "ExponentPushToken[e2e-••••tnet]",
    });
    expect(await getPushRegistration()).toBeNull();
  });

  it("a rota é chamada com sessão válida: o 404 não derruba o login", async () => {
    const again = await setupPushNotifications({ prompt: false });

    expect(again.status).toBe("server_unavailable");
    // Um 401 teria limpado a sessão (MOB-01). Ela continua, e o token JWT ainda vale na API.
    const session = await getAuthSession();
    expect(session).not.toBeNull();
    const plants = await fetch(`${API}/plants`, { headers: { Authorization: `Bearer ${session!.token}` } });
    expect(plants.status).toBe(200);
  });

  it("logout não quebra mesmo sem a rota de remoção", async () => {
    await expect(unregisterPushDevice()).resolves.toBeUndefined();
  });
});
