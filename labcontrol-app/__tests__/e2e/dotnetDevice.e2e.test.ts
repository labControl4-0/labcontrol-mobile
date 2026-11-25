/**
 * @jest-environment node
 */
// MOB-05: registro do aparelho contra a API real do LabControl (ASP.NET Core +
// Postgres). Usa o código real do app; só o módulo nativo de notificações é
// simulado, com um token SINTÉTICO (o ExpoPushToken real só existe no aparelho).
//
// Exercita as rotas do BE-07 na API .NET.
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

  it("registra o aparelho e mantém a sessão válida", async () => {
    const result = await setupPushNotifications({ prompt: true });

    expect(result).toMatchObject({ status: "registered", alreadyRegistered: false });
    expect(await getPushRegistration()).toMatchObject({
      pushToken: "ExponentPushToken[e2e-sintetico-dotnet]",
    });
    expect(await getAuthSession()).not.toBeNull();
  });

  it("rejeita um token inválido e um registro sem autenticação", async () => {
    const session = await getAuthSession();
    const options = {
      method: "POST",
      body: JSON.stringify({ pushToken: "invalid", platform: "android" }),
      headers: { "Content-Type": "application/json" },
    };
    expect((await fetch(`${API}/devices`, options)).status).toBe(401);
    const invalid = await fetch(`${API}/devices`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${session!.token}` },
    });
    expect(invalid.status).toBe(400);
  });

  it("remove a associação no logout e limpa o registro local", async () => {
    const session = await getAuthSession();
    const requests: Response[] = [];
    const realFetch = global.fetch;
    const spy = jest.spyOn(global, "fetch").mockImplementation(async (...args) => {
      const response = await realFetch(...args);
      if (args[1]?.method === "DELETE") requests.push(response);
      return response;
    });
    try {
      await unregisterPushDevice();
      expect(requests.map((response) => response.status)).toEqual([204]);
      expect(await getPushRegistration()).toBeNull();
      expect((await getAuthSession())?.token).toBe(session?.token);
    } finally {
      spy.mockRestore();
    }
  });
});
