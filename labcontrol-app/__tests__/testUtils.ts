// Utilitários compartilhados pelos testes. Todos os dados são sintéticos.
export const API_URL = "https://api.example.test/api";
export const TOKEN = "token-sintetico-123";
export const USER = { id: "u-1", name: "Usuária Teste", email: "teste@example.test" };

type FakeResponse = { status: number; body?: unknown };

export function fakeResponse({ status, body }: FakeResponse) {
  const text =
    body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  };
}

/** fetch que nunca responde, mas rejeita quando o AbortSignal dispara (como o fetch real). */
export function hangingFetch() {
  return jest.fn(
    (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new Error("Aborted"))
        );
      })
  );
}

export function mockFetch(...responses: FakeResponse[]) {
  const fn = jest.fn();
  for (const r of responses) fn.mockResolvedValueOnce(fakeResponse(r));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

/** Lê o header enviado na n-ésima chamada do fetch mockado. */
export function sentHeader(fetchMock: jest.Mock, name: string, call = 0) {
  const init = fetchMock.mock.calls[call][1];
  return new Headers(init.headers).get(name);
}
