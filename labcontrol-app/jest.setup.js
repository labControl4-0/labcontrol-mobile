// Substitui o AsyncStorage nativo por uma implementação em memória nos testes.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
