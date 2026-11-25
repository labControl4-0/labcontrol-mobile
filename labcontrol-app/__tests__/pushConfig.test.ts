// MOB-05: configuração do build sem segredos no Git.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require("../app.config.js");
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8")).expo;
const easJson = JSON.parse(fs.readFileSync(path.join(ROOT, "eas.json"), "utf8"));

describe("app.config.js", () => {
  it("no EAS Build usa o arquivo da variável secreta GOOGLE_SERVICES_JSON", () => {
    const config = appConfig.buildConfig(appJson, { GOOGLE_SERVICES_JSON: "/tmp/eas/google-services.json" });
    expect(config.android.googleServicesFile).toBe("/tmp/eas/google-services.json");
  });

  it("sem variável e sem arquivo local, não aponta para um arquivo inexistente", () => {
    const hasLocal = fs.existsSync(path.join(ROOT, "google-services.json"));
    const config = appConfig.buildConfig(appJson, {});
    expect(config.android.googleServicesFile).toBe(hasLocal ? "./google-services.json" : undefined);
  });

  it("mantém o pacote Android e aceita o projectId por EAS_PROJECT_ID", () => {
    const config = appConfig.buildConfig(appJson, { EAS_PROJECT_ID: "00000000-0000-4000-8000-000000000000" });
    expect(config.android.package).toBe("com.labcontrol.mobile");
    expect(config.extra.eas.projectId).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("registra o plugin do expo-notifications com o canal padrão", () => {
    const plugin = appJson.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-notifications");
    expect(plugin?.[1]).toMatchObject({ defaultChannel: "machine-alerts" });
  });
});

describe("eas.json", () => {
  it("tem perfil development com dev client, distribuição interna e APK", () => {
    expect(easJson.build.development).toMatchObject({
      developmentClient: true,
      distribution: "internal",
      environment: "development",
      android: { buildType: "apk" },
    });
  });
});

describe("credenciais fora do Git", () => {
  const PRIVATE = [
    "google-services.json",
    "GoogleService-Info.plist",
    "projeto-firebase-adminsdk-abc12.json",
    "service-account.json",
    "credentials.json",
    "release.keystore",
  ];

  it("o .gitignore ignora google-services, chave FCM V1 e keystores", () => {
    const ignored = execSync(`git check-ignore --no-index ${PRIVATE.join(" ")}`, {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
    expect(ignored.sort()).toEqual([...PRIVATE].sort());
  });

  it("nenhum arquivo de credencial está versionado", () => {
    const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/);
    const offenders = tracked.filter((f) =>
      /google-services\.json$|GoogleService-Info\.plist$|firebase-adminsdk|service-account|\.keystore$|credentials\.json$/i.test(f)
    );
    expect(offenders).toEqual([]);
  });

  it("nenhum arquivo versionado contém chave privada ou chave de API do Google", () => {
    const tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
      .split(/\r?\n/)
      .filter((f) => f && /\.(json|js|ts|tsx|md|env|example)$/.test(f) && !f.endsWith("package-lock.json"));
    const offenders = tracked.filter((f) => {
      const full = path.join(ROOT, f);
      if (!fs.existsSync(full)) return false;
      const content = fs.readFileSync(full, "utf8");
      return /-----BEGIN (RSA )?PRIVATE KEY-----|"private_key"\s*:|AIza[0-9A-Za-z_-]{35}/.test(content);
    });
    expect(offenders).toEqual([]);
  });
});
