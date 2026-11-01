import AsyncStorage from "@react-native-async-storage/async-storage";

import { getAuthSession, saveAuthSession } from "../lib/auth";
import { ApiError, apiFetch, setUnauthorizedHandler } from "../services/api";
import { API_URL, TOKEN, USER, hangingFetch, mockFetch, sentHeader } from "./testUtils";

const onUnauthorized = jest.fn();

beforeEach(async () => {
  await AsyncStorage.clear();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  onUnauthorized.mockReset();
  setUnauthorizedHandler(onUnauthorized);
});

describe("header de autorização", () => {
  it("envia o token resolvido como string, nunca Promise", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    const fetchMock = mockFetch({ status: 200, body: [] });

    await apiFetch("/plants");

    const header = sentHeader(fetchMock, "Authorization");
    expect(header).toBe(`Bearer ${TOKEN}`);
    expect(header).not.toContain("[object Promise]");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}/plants`);
  });

  it("não envia Authorization sem sessão", async () => {
    const fetchMock = mockFetch({ status: 200, body: [] });

    await apiFetch("/plants");

    expect(sentHeader(fetchMock, "Authorization")).toBeNull();
  });

  it("skipAuth não envia token (login/cadastro)", async () => {
    await saveAuthSession({ token: TOKEN });
    const fetchMock = mockFetch({ status: 200, body: {} });

    await apiFetch("/Auth/login", { method: "POST", body: "{}", skipAuth: true });

    expect(sentHeader(fetchMock, "Authorization")).toBeNull();
  });
});

describe("expiração de sessão (401)", () => {
  it("limpa a sessão, aciona o retorno ao login e lança ApiError unauthorized", async () => {
    await saveAuthSession({ token: TOKEN, ...USER });
    mockFetch({ status: 401, body: { message: "token expirado" } });

    const error = await apiFetch("/plants").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("unauthorized");
    expect(error.message).toBe("Sessão expirada. Faça login novamente.");
    expect(await getAuthSession()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("várias requisições com 401 ao mesmo tempo redirecionam uma vez só", async () => {
    await saveAuthSession({ token: TOKEN });
    mockFetch({ status: 401 }, { status: 401 }, { status: 401 });

    await Promise.allSettled([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(await getAuthSession()).toBeNull();
  });

  it("401 no login (skipAuth) não limpa sessão nem redireciona", async () => {
    await saveAuthSession({ token: TOKEN });
    mockFetch({ status: 401, body: { message: "E-mail ou senha inválidos." } });

    const error = await apiFetch("/Auth/login", { skipAuth: true }).catch((e) => e);

    expect(error.message).toBe("E-mail ou senha inválidos.");
    expect(await getAuthSession()).not.toBeNull();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("401 de uma sessão antiga não derruba um login novo", async () => {
    await saveAuthSession({ token: "token-antigo" });
    global.fetch = jest.fn(async () => {
      // Usuário faz login de novo enquanto a requisição antiga está em voo.
      await saveAuthSession({ token: TOKEN });
      return { ok: false, status: 401, text: async () => "" };
    }) as unknown as typeof fetch;

    await apiFetch("/plants").catch(() => undefined);

    expect((await getAuthSession())?.token).toBe(TOKEN);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("timeout e erros padronizados", () => {
  it("aborta após o timeout e lança ApiError timeout", async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;

    const error = await apiFetch("/plants", { timeoutMs: 20 }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("timeout");
  });

  it("falha de rede vira ApiError network", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));

    const error = await apiFetch("/plants").catch((e) => e);

    expect(error.code).toBe("network");
  });

  it("erro HTTP usa a mensagem do backend e guarda o status", async () => {
    mockFetch({ status: 500, body: { title: "Falha interna" } });

    const error = await apiFetch("/plants").catch((e) => e);

    expect(error.code).toBe("http");
    expect(error.status).toBe(500);
    expect(error.message).toBe("Falha interna");
  });

  it("sem EXPO_PUBLIC_API_URL lança ApiError config e não chama fetch", async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const fetchMock = mockFetch({ status: 200 });

    const error = await apiFetch("/plants").catch((e) => e);

    expect(error.code).toBe("config");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
