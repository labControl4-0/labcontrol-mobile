// Utilitários compartilhados pelos testes. Todos os dados são sintéticos.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as SQLiteMock from "expo-sqlite";

import { forgetDatabaseConnection } from "../lib/offline/database";

type SqliteMock = { __disk: Map<string, Uint8Array>; __resetDisk: () => void };
const sqliteMock = SQLiteMock as unknown as SqliteMock;

export const API_URL = "https://api.example.test/api";
export const TOKEN = "token-sintetico-123";
export const USER = { id: "u-1", name: "Usuária Teste", email: "teste@example.test" };

type FakeResponse = { status: number; body?: unknown };

export function fakeResponse({ status, body }: FakeResponse) {
  const text =
    body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  };
}

/** fetch que nunca responde, mas rejeita quando o AbortSignal dispara (como o fetch real). */
export function hangingFetch() {
  return jest.fn(
    (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new Error("Aborted"))
        );
      })
  );
}

export function mockFetch(...responses: FakeResponse[]) {
  const fn = jest.fn();
  for (const r of responses) fn.mockResolvedValueOnce(fakeResponse(r));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Lê o header enviado na n-ésima chamada do fetch mockado. */
export function sentHeader(fetchMock: jest.Mock, name: string, call = 0) {
  const init = fetchMock.mock.calls[call][1];
  return new Headers(init.headers).get(name);
}

export const OTHER_USER = { id: "u-2", name: "Outro Usuário", email: "outro@example.test" };
export const OTHER_TOKEN = "token-sintetico-456";

/** Conteúdo do SecureStore mockado (jest.setup.js). */
export function secureStoreContents(): Map<string, string> {
  return (SecureStore as unknown as { __store: Map<string, string> }).__store;
}

/** Zera todo o armazenamento local entre testes. */
export async function resetStorage() {
  await AsyncStorage.clear();
  secureStoreContents().clear();
  forgetDatabaseConnection();
  sqliteMock.__resetDisk();
}

/** Bytes de todos os bancos SQLite "gravados no aparelho", como texto. */
export function sqliteFileDump(): string {
  return [...sqliteMock.__disk.values()]
    .map((bytes) => Buffer.from(bytes).toString("latin1"))
    .join("\n");
}

/**
 * Simula o sistema encerrando o app: descarta a conexão aberta e todo o estado
 * em memória dos módulos. Só o que foi gravado no "aparelho" continua.
 */
export async function simulateAppKill() {
  // O AsyncStorage real fica em disco; o mock fica no módulo, então é copiado.
  const pairs = await AsyncStorage.multiGet(await AsyncStorage.getAllKeys());

  forgetDatabaseConnection();
  jest.resetModules();

  const reopened = require("@react-native-async-storage/async-storage").default
    ?? require("@react-native-async-storage/async-storage");
  if (pairs.length > 0) await reopened.multiSet(pairs as [string, string][]);
}

/** Todos os pares chave/valor do AsyncStorage (no Android, gravado em SQLite). */
export async function asyncStorageDump(): Promise<string> {
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  return JSON.stringify(pairs);
}
