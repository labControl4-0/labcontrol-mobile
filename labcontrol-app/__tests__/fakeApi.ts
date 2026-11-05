// API falsa em memória para os testes da fila (MOB-04). Responde como o
// MachineEventsController atual: POST /machine-events e
// GET /machine-events/machine/{machineId}. Dados sintéticos.
import { API_URL, fakeResponse } from "./testUtils";

export type FakeEvent = {
  id: string;
  machineId: string;
  eventType: string;
  message: string;
  createdAt: string;
};

/**
 * Como responder a um POST. "commitThenTimeout": grava o evento e nunca
 * responde (o app desiste por timeout), como uma resposta perdida na rede.
 */
export type PostBehavior = "ok" | "down" | "commitThenTimeout" | number;

type Init = { method?: string; body?: string; headers?: HeadersInit; signal?: AbortSignal };

export function createFakeApi() {
  const events: FakeEvent[] = [];
  const posts: Array<Record<string, unknown>> = [];
  const idempotencyKeys: Array<string | null> = [];
  let down = false;
  let postPlan: PostBehavior[] = [];
  let held: { release: () => void; fail: () => void } | null = null;
  let holdNext = false;

  const neverAnswer = (signal?: AbortSignal) =>
    new Promise<never>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    });

  async function handle(url: string, init: Init = {}) {
    if (holdNext) {
      holdNext = false;
      const outcome = await new Promise<"release" | "fail">((resolve) => {
        held = { release: () => resolve("release"), fail: () => resolve("fail") };
      });
      held = null;
      if (outcome === "fail") throw new TypeError("Network request failed");
    }

    if (down) throw new TypeError("Network request failed");

    const path = url.replace(API_URL, "");
    const method = (init.method ?? "GET").toUpperCase();

    if (method === "POST" && path === "/machine-events") {
      const behavior = postPlan.shift() ?? "ok";
      if (behavior === "down") throw new TypeError("Network request failed");
      if (typeof behavior === "number") {
        return fakeResponse({ status: behavior, body: { message: `Erro ${behavior}` } });
      }

      const body = JSON.parse(init.body ?? "{}");
      posts.push(body);
      idempotencyKeys.push(new Headers(init.headers).get("Idempotency-Key"));
      const event: FakeEvent = {
        id: `srv-${events.length + 1}`,
        machineId: body.machineId,
        eventType: body.eventType,
        message: body.message,
        createdAt: new Date().toISOString(),
      };
      events.push(event);

      if (behavior === "commitThenTimeout") return neverAnswer(init.signal);
      return fakeResponse({ status: 201, body: event });
    }

    const byMachine = /^\/machine-events\/machine\/([^/]+)$/.exec(path);
    if (method === "GET" && byMachine) {
      return fakeResponse({
        status: 200,
        body: events.filter((e) => e.machineId === byMachine[1]),
      });
    }

    return fakeResponse({ status: 404, body: { message: "Not found" } });
  }

  const fetchMock = jest.fn((url: string, init?: Init) => handle(url, init));
  global.fetch = fetchMock as unknown as typeof fetch;

  return {
    events,
    posts,
    idempotencyKeys,
    fetchMock,
    /** Simula backend parado (true) ou de volta (false). */
    setDown(value: boolean) {
      down = value;
    },
    /** Comportamento dos próximos POSTs, em ordem. Depois volta a "ok". */
    planPosts(...plan: PostBehavior[]) {
      postPlan = plan;
    },
    /** Segura a próxima requisição até release() ou fail(). */
    holdNextRequest() {
      holdNext = true;
    },
    get held() {
      return held;
    },
    countGets: () =>
      fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "GET").length,
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitUntil(condition: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("Condição não atingida a tempo.");
    await sleep(5);
  }
}
