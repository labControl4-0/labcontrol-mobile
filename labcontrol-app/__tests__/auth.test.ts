import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  LEGACY_KEYS,
  clearAuthSession,
  getAuthSession,
  getAuthToken,
  purgeLegacyStorage,
  saveAuthSession,
} from "../lib/auth";
import { TOKEN, USER, resetStorage, secureStoreContents } from "./testUtils";

beforeEach(resetStorage);

describe("sessão (lib/auth.ts)", () => {
  it("persiste a sessão e a recupera depois (simula reabrir o app)", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });

    expect(await getAuthSession()).toEqual({ token: TOKEN, user: USER });
    expect(await getAuthToken()).toBe(TOKEN);
  });

  it("aceita resposta com accessToken e user aninhado", async () => {
    await saveAuthSession({ accessToken: TOKEN, user: USER });

    expect(await getAuthToken()).toBe(TOKEN);
    expect((await getAuthSession())?.user).toEqual(USER);
  });

  it("getAuthToken resolve para string, nunca para Promise", async () => {
    await saveAuthSession({ token: TOKEN });

    const token = await getAuthToken();

    expect(typeof token).toBe("string");
    expect(token).not.toBeInstanceOf(Promise);
  });

  it("recusa resposta de login sem token", async () => {
    await expect(saveAuthSession({ ...USER })).rejects.toThrow("sem token");
    expect(await getAuthSession()).toBeNull();
  });

  it("logout limpa token, perfil e chaves legadas", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    await AsyncStorage.setItem("@labcontrol:token", "token-antigo");

    await clearAuthSession();

    expect(await getAuthSession()).toBeNull();
    expect(secureStoreContents().size).toBe(0);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it("descarta perfil corrompido no armazenamento", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    await AsyncStorage.setItem("@labcontrol:profile", "{json-invalido");

    expect(await getAuthSession()).toBeNull();
    expect(secureStoreContents().size).toBe(0);
  });

  it("perfil sem token (ex.: aba web fechada) volta ao login e é apagado", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    secureStoreContents().clear();

    expect(await getAuthSession()).toBeNull();
    expect(await AsyncStorage.getItem("@labcontrol:profile")).toBeNull();
  });

  it("remove na abertura as chaves antigas que guardavam o token", async () => {
    await AsyncStorage.setItem("@labcontrol:session", JSON.stringify({ token: TOKEN }));
    await AsyncStorage.setItem("@labcontrol:token", TOKEN);
    await AsyncStorage.setItem("profile_image_uri", "file:///foto.jpg");

    await purgeLegacyStorage();

    for (const key of LEGACY_KEYS) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
  });
});
