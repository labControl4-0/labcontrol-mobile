// Substitui o AsyncStorage nativo por uma implementação em memória nos testes.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// SecureStore em memória. `__store` permite aos testes inspecionar o conteúdo.
jest.mock("expo-secure-store", () => {
  const store = new Map();
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
