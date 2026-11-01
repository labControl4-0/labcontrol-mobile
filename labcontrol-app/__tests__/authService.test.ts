import { getAuthSession } from "../lib/auth";
import { login } from "../services/authService";
import { API_URL, TOKEN, USER, mockFetch, resetStorage } from "./testUtils";

beforeEach(async () => {
  await resetStorage();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
});

describe("login (services/authService.ts)", () => {
  it("persiste a sessão retornada pelo backend", async () => {
    mockFetch({ status: 200, body: { ...USER, token: TOKEN } });

    const session = await login({ email: USER.email, password: "senha-teste" });

    expect(session).toEqual({ token: TOKEN, user: USER });
    expect(await getAuthSession()).toEqual({ token: TOKEN, user: USER });
  });

  it("credencial inválida não grava sessão", async () => {
    mockFetch({ status: 401, body: { message: "E-mail ou senha inválidos." } });

    await expect(
      login({ email: USER.email, password: "errada" })
    ).rejects.toThrow("E-mail ou senha inválidos.");
    expect(await getAuthSession()).toBeNull();
  });
});
