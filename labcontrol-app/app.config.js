// Configuração dinâmica do Expo (MOB-05). Ver docs/PUSH_NOTIFICATIONS.md.
//
// O app.json é a base. Este arquivo só acrescenta o que não pode ser versionado:
//
// - google-services.json (Firebase): no EAS Build vem da variável de arquivo
//   GOOGLE_SERVICES_JSON (eas env:set ... --type file --visibility secret).
//   Localmente, usa ./google-services.json se existir. O arquivo está no
//   .gitignore e nunca entra no repositório.
// - projectId do EAS: gravado no app.json por `npx eas-cli@latest init`, ou
//   informado por EAS_PROJECT_ID.
const fs = require("fs");
const path = require("path");

function resolveGoogleServicesFile(env = process.env) {
  if (env.GOOGLE_SERVICES_JSON) return env.GOOGLE_SERVICES_JSON;
  const local = path.join(__dirname, "google-services.json");
  return fs.existsSync(local) ? "./google-services.json" : undefined;
}

function buildConfig(config, env = process.env) {
  const googleServicesFile = resolveGoogleServicesFile(env);
  const projectId = env.EAS_PROJECT_ID || config.extra?.eas?.projectId;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
}

module.exports = ({ config }) => buildConfig(config);
module.exports.buildConfig = buildConfig;
module.exports.resolveGoogleServicesFile = resolveGoogleServicesFile;
