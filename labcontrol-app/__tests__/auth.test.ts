import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearAuthSession,
  getAuthSession,
  getAuthToken,
  saveAuthSession,
} from "../lib/auth";
import { TOKEN, USER } from "./testUtils";

beforeEach(async () => {
  await AsyncStorage.clear();
});

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

  it("logout limpa a sessão e as chaves legadas", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    await AsyncStorage.setItem("@labcontrol:token", "token-antigo");
    await AsyncStorage.setItem("@labcontrol:user", "{}");

    await clearAuthSession();

    expect(await getAuthSession()).toBeNull();
    expect(await getAuthToken()).toBeNull();
    expect(await AsyncStorage.getItem("@labcontrol:token")).toBeNull();
    expect(await AsyncStorage.getItem("@labcontrol:user")).toBeNull();
  });

  it("descarta sessão corrompida no armazenamento", async () => {
    await AsyncStorage.setItem("@labcontrol:session", "{json-invalido");

    expect(await getAuthSession()).toBeNull();
    expect(await AsyncStorage.getItem("@labcontrol:session")).toBeNull();
  });
});
