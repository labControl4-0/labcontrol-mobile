// Configuração do Metro exigida pelo expo-sqlite na web (MOB-03).
// https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/#web-setup
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// O SQLite da web é um arquivo WebAssembly.
config.resolver.assetExts.push("wasm");

// SharedArrayBuffer (usado pelo SQLite na web) exige estes cabeçalhos.
// Em produção, o servidor web também precisa enviá-los.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  middleware(req, res, next);
};

module.exports = config;
