// MOB-02: armazenamento seguro, cache por usuário, retenção e logout.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearAuthSession, getAuthSession, saveAuthSession } from "../lib/auth";
import { createWebSecretStore } from "../lib/secureStorage";
import { userCache } from "../lib/userCache";
import {
  OTHER_TOKEN,
  OTHER_USER,
  TOKEN,
  USER,
  asyncStorageDump,
  resetStorage,
  secureStoreContents,
} from "./testUtils";

beforeEach(resetStorage);

describe("token no armazenamento seguro", () => {
  it("token vai para o SecureStore e nunca para o AsyncStorage (SQLite no Android)", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });

    expect([...secureStoreContents().values()]).toEqual([TOKEN]);
    expect(await asyncStorageDump()).not.toContain(TOKEN);
  });

  it("o perfil gravado no AsyncStorage não contém o token", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });

    const profile = JSON.parse((await AsyncStorage.getItem("@labcontrol:profile"))!);
    expect(profile).toEqual({ user: USER });
  });

  it("grava com acesso restrito a este aparelho (sem backup)", async () => {
    const SecureStore = require("expo-secure-store");

    await saveAuthSession({ token: TOKEN, ...USER });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "labcontrol.auth.token",
      TOKEN,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    );
  });
});

describe("estratégia web", () => {
  function fakeSessionStorage() {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  it("usa o sessionStorage da aba", async () => {
    const storage = fakeSessionStorage();
    const store = createWebSecretStore(() => storage);

    await store.setItem("labcontrol.auth.token", TOKEN);

    expect(storage.data.get("labcontrol.auth.token")).toBe(TOKEN);
    expect(await store.getItem("labcontrol.auth.token")).toBe(TOKEN);

    await store.removeItem("labcontrol.auth.token");
    expect(storage.data.size).toBe(0);
  });

  it("sem sessionStorage (render estático) guarda só em memória", async () => {
    const store = createWebSecretStore(() => null);

    await store.setItem("labcontrol.auth.token", TOKEN);

    expect(await store.getItem("labcontrol.auth.token")).toBe(TOKEN);
    expect(await asyncStorageDump()).not.toContain(TOKEN);
  });
});

describe("troca de usuário", () => {
  it("após logout, o usuário seguinte não vê dados do anterior", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    await userCache(USER.id).set("profileImageUri", "file:///foto-a.jpg");
    await userCache(USER.id).set("plants", [{ id: "p-1", name: "Lab A" }]);

    await clearAuthSession();
    await saveAuthSession({ token: OTHER_TOKEN, ...OTHER_USER });

    const cacheB = userCache(OTHER_USER.id);
    expect(await cacheB.get("profileImageUri")).toBeNull();
    expect(await cacheB.get("plants")).toBeNull();
    expect((await getAuthSession())?.user).toEqual(OTHER_USER);
    expect(await asyncStorageDump()).not.toContain("Lab A");
  });

  it("sem logout (ex.: app fechado), o login de outro usuário apaga o cache anterior", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    await userCache(USER.id).set("plants", [{ id: "p-1", name: "Lab A" }]);

    await saveAuthSession({ token: OTHER_TOKEN, ...OTHER_USER });

    expect(await asyncStorageDump()).not.toContain("Lab A");
    expect([...secureStoreContents().values()]).toEqual([OTHER_TOKEN]);
  });

  it("a leitura só enxerga o cache do próprio usuário", async () => {
    await userCache(USER.id).set("plants", ["dado-de-A"]);

    expect(await userCache(OTHER_USER.id).get("plants")).toBeNull();
    expect(await userCache(USER.id).get("plants")).toEqual(["dado-de-A"]);
  });

  it("novo login do mesmo usuário mantém o cache dele", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    await userCache(USER.id).set("plants", ["dado-de-A"]);

    await saveAuthSession({ token: "token-renovado", ...USER });

    expect(await userCache(USER.id).get("plants")).toEqual(["dado-de-A"]);
  });
});

describe("retenção local", () => {
  afterEach(() => jest.restoreAllMocks());

  it("dado dentro do prazo é lido; depois do prazo some e é apagado", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    const cache = userCache(USER.id);

    await cache.set("plants", ["x"], 60_000);

    now.mockReturnValue(1_000_000 + 59_999);
    expect(await cache.get("plants")).toEqual(["x"]);

    now.mockReturnValue(1_000_000 + 60_000);
    expect(await cache.get("plants")).toBeNull();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it("prazo padrão é de 24 horas", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(0);
    const cache = userCache(USER.id);

    await cache.set("plants", ["x"]);

    now.mockReturnValue(24 * 60 * 60 * 1000 - 1);
    expect(await cache.get("plants")).toEqual(["x"]);

    now.mockReturnValue(24 * 60 * 60 * 1000);
    expect(await cache.get("plants")).toBeNull();
  });

  it("entrada corrompida é descartada", async () => {
    await AsyncStorage.setItem("@labcontrol:cache:u-1:plants", "{quebrado");

    expect(await userCache(USER.id).get("plants")).toBeNull();
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});

describe("logout", () => {
  it("remove token, sessão e todo o cache local", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    await userCache(USER.id).set("profileImageUri", "file:///foto-a.jpg");

    await clearAuthSession();

    expect(secureStoreContents().size).toBe(0);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await getAuthSession()).toBeNull();
  });
});
