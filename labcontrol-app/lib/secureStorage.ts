// Armazenamento de credenciais (token). Ver docs/POLITICA_DE_DADOS.md.
//
// Nativo (Android/iOS): expo-secure-store (Keystore/Keychain), sem backup para
//   outro aparelho (WHEN_UNLOCKED_THIS_DEVICE_ONLY).
// Web: o SecureStore não existe. A credencial fica no sessionStorage da aba,
//   que é apagado ao fechar a aba e não é compartilhado entre abas. Nunca no
//   localStorage. Sem sessionStorage (ex.: render estático no Node), fica só em memória.
//
// Credencial NUNCA vai para AsyncStorage: no Android ele é gravado em SQLite.
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface SecretStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Chaves do SecureStore só aceitam letras, números, ".", "-" e "_".
const VALID_KEY = /^[A-Za-z0-9._-]+$/;

function assertValidKey(key: string) {
  if (!VALID_KEY.test(key)) {
    throw new Error(`Chave inválida para armazenamento seguro: ${key}`);
  }
}

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const nativeSecretStore: SecretStore = {
  async getItem(key) {
    assertValidKey(key);
    return SecureStore.getItemAsync(key, SECURE_OPTIONS);
  },
  async setItem(key, value) {
    assertValidKey(key);
    await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
  },
  async removeItem(key) {
    assertValidKey(key);
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
  },
};

type WebStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultWebStorage(): WebStorage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    // Navegadores com armazenamento bloqueado lançam ao acessar sessionStorage.
    return null;
  }
}

/** Estratégia web. `resolveStorage` é resolvido a cada chamada (seguro para SSR). */
export function createWebSecretStore(
  resolveStorage: () => WebStorage | null = defaultWebStorage
): SecretStore {
  const memory = new Map<string, string>();

  return {
    async getItem(key) {
      assertValidKey(key);
      const storage = resolveStorage();
      return storage ? storage.getItem(key) : memory.get(key) ?? null;
    },
    async setItem(key, value) {
      assertValidKey(key);
      const storage = resolveStorage();
      if (storage) storage.setItem(key, value);
      else memory.set(key, value);
    },
    async removeItem(key) {
      assertValidKey(key);
      resolveStorage()?.removeItem(key);
      memory.delete(key);
    },
  };
}

export const secretStore: SecretStore =
  Platform.OS === "web" ? createWebSecretStore() : nativeSecretStore;
