// Substitui o AsyncStorage nativo por uma implementação em memória nos testes.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// SecureStore em memória. `__store` permite aos testes inspecionar o conteúdo.
jest.mock("expo-secure-store", () => {
  // Em globalThis para sobreviver a jest.resetModules(), como o Keystore real
  // sobrevive ao app ser fechado.
  const store = (globalThis.__SECURE_STORE__ = globalThis.__SECURE_STORE__ || new Map());
  const VALID_KEY = /^[A-Za-z0-9._-]+$/;

  const check = (key) => {
    if (!VALID_KEY.test(key)) throw new Error(`Invalid key: ${key}`);
  };

  return {
    __store: store,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
    getItemAsync: jest.fn(async (key) => {
      check(key);
      return store.has(key) ? store.get(key) : null;
    }),
    setItemAsync: jest.fn(async (key, value) => {
      check(key);
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      check(key);
      store.delete(key);
    }),
  };
});

// SQLite real (sql.js) com "arquivo" em memória que sobrevive à reabertura.
jest.mock("expo-sqlite", () => require("./__tests__/mocks/expoSqlite"));

// Estado de rede controlável nos testes de reconexão.
jest.mock("expo-network", () => require("./__tests__/mocks/expoNetwork"));

// UUID v4 do Node no lugar do módulo nativo.
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => require("crypto").randomUUID()),
}));
