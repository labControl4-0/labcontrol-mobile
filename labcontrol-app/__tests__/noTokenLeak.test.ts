// MOB-02: o token não pode aparecer em logs nem em armazenamento baseado em SQLite.
import fs from "fs";
import path from "path";

import { clearAuthSession, saveAuthSession } from "../lib/auth";
import { apiFetch, setUnauthorizedHandler } from "../services/api";
import { login } from "../services/authService";
import {
  API_URL,
  TOKEN,
  USER,
  asyncStorageDump,
  mockFetch,
  resetStorage,
} from "./testUtils";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;
const ROOT = path.resolve(__dirname, "..");

/** Arquivos .ts/.tsx do app, com caminho relativo à raiz do projeto. */
function listSourceFiles(dir: string): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];

  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

const SOURCE_FILES = () => ["app", "lib", "services"].flatMap(listSourceFiles);
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

function spyConsole() {
  return CONSOLE_METHODS.map((m) =>
    jest.spyOn(console, m).mockImplementation(() => undefined)
  );
}

function loggedText(spies: jest.SpyInstance[]) {
  return spies
    .flatMap((s) => s.mock.calls.flat())
    .map((arg) => {
      if (arg instanceof Error) return `${arg.message} ${arg.stack ?? ""}`;
      try {
        return typeof arg === "string" ? arg : JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join("\n");
}

beforeEach(async () => {
  await resetStorage();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setUnauthorizedHandler(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

it("fluxo completo (login, requisição, 401, falha de rede, logout) não registra o token", async () => {
  const spies = spyConsole();

  mockFetch({ status: 200, body: { ...USER, token: TOKEN } });
  await login({ email: USER.email, password: "senha-teste" });

  mockFetch({ status: 200, body: [] });
  await apiFetch("/plants");

  mockFetch({ status: 401 });
  await apiFetch("/plants").catch(() => undefined);

  await saveAuthSession({ token: TOKEN, ...USER });
  global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
  await apiFetch("/plants").catch(() => undefined);

  await clearAuthSession();

  expect(loggedText(spies)).not.toContain(TOKEN);
  expect(await asyncStorageDump()).not.toContain(TOKEN);
});

it("o código não loga token, sessão, senha ou header Authorization", () => {
  const SENSITIVE = /console\.\w+\([^)]*\b(token|accessToken|session|password|senha|Authorization)\b/i;

  const files = SOURCE_FILES();
  const offenders = files.filter((f) => SENSITIVE.test(read(f)));

  expect(files.length).toBeGreaterThan(0);
  expect(offenders).toEqual([]);
});

it("arquivos que usam SQLite não acessam o token", () => {
  // SQLite pode ser usado para cache offline, mas nunca para credenciais.
  const USES_SQLITE = /from\s+["']expo-sqlite["']|require\(["']expo-sqlite["']\)/;
  const TOUCHES_TOKEN = /\b(getAuthToken|getAuthSession|secretStore|secureStorage|token)\b/;

  const offenders = SOURCE_FILES().filter((f) => {
    const content = read(f);
    return USES_SQLITE.test(content) && TOUCHES_TOKEN.test(content);
  });

  expect(offenders).toEqual([]);
});
