import {
  findAuthorizedMachineEvent,
  type AuthorizedMachineEvent,
} from "../lib/push/authorizedMachineEvent";
import {
  parseMachineEventPushPayload,
  routeForMachineEventPush,
} from "../lib/push/notificationPayload";
import {
  navigateFromNotificationData,
  startPushNavigation,
} from "../services/pushNavigation";

jest.mock("expo-notifications", () => {
  const root = globalThis as any;
  const state =
    root.__PUSH_NAVIGATION_TEST_STATE__ ||
    (root.__PUSH_NAVIGATION_TEST_STATE__ = {
      received: null,
      response: null,
      lastResponse: null,
      clearCount: 0,
    });

  return {
    DEFAULT_ACTION_IDENTIFIER: "default",
    addNotificationReceivedListener: jest.fn((listener) => {
      state.received = listener;
      return {
        remove: jest.fn(() => {
          state.received = null;
        }),
      };
    }),
    addNotificationResponseReceivedListener: jest.fn((listener) => {
      state.response = listener;
      return {
        remove: jest.fn(() => {
          state.response = null;
        }),
      };
    }),
    getLastNotificationResponseAsync: jest.fn(async () => state.lastResponse),
    clearLastNotificationResponseAsync: jest.fn(async () => {
      state.clearCount += 1;
      state.lastResponse = null;
    }),
  };
});

const VALID_PAYLOAD = {
  categoria: "failure",
  avisoId: "2e1a1e01-6cb0-4c5e-8c49-5f35ee6ec121",
  machineId: "3f1c2a9e-0000-4000-8000-000000000001",
  origem: "machine-events",
};

const MACHINE_EVENT: AuthorizedMachineEvent = {
  id: VALID_PAYLOAD.avisoId,
  machineId: VALID_PAYLOAD.machineId,
  eventType: "failure",
  message: "Vazamento de óleo.",
  createdAt: "2026-11-06T12:30:00.000Z",
  resolvedAt: null,
};

function getMockState() {
  return (globalThis as any).__PUSH_NAVIGATION_TEST_STATE__;
}

function makeResponse(data: unknown, identifier = "push-1") {
  return {
    actionIdentifier: "default",
    notification: {
      request: {
        identifier,
        content: { data },
      },
    },
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  const state = getMockState();
  state.received = null;
  state.response = null;
  state.lastResponse = null;
  state.clearCount = 0;
});

describe("payload do push", () => {
  it("aceita um aviso válido e cria sempre uma rota interna fixa", () => {
    expect(parseMachineEventPushPayload(VALID_PAYLOAD)).toEqual(VALID_PAYLOAD);
    expect(routeForMachineEventPush(VALID_PAYLOAD)).toEqual({
      pathname: "/NotificationEvent",
      params: VALID_PAYLOAD,
    });
  });

  it("rejeita payload inválido e não aceita URL fornecida pelo servidor", () => {
    expect(routeForMachineEventPush({ url: "https://example.test" })).toBeNull();
    expect(routeForMachineEventPush({ ...VALID_PAYLOAD, categoria: "admin" })).toBeNull();
    expect(routeForMachineEventPush({ ...VALID_PAYLOAD, avisoId: "../settings" })).toBeNull();
    expect(routeForMachineEventPush({ ...VALID_PAYLOAD, machineId: "" })).toBeNull();
    expect(routeForMachineEventPush({ ...VALID_PAYLOAD, origem: " " })).toBeNull();
  });

  it("só navega com payload válido e sessão autenticada", async () => {
    const router = { push: jest.fn() };
    const readSession = jest.fn(async () => ({
      token: "token-sintetico",
      user: { id: "usuario-teste" },
    }));

    const status = await navigateFromNotificationData(
      VALID_PAYLOAD,
      router,
      readSession
    );

    expect(status).toBe("opened");
    expect(router.push).toHaveBeenCalledWith(routeForMachineEventPush(VALID_PAYLOAD));
  });

  it("não navega quando não há sessão e rejeita o payload antes de ler a sessão", async () => {
    const router = { push: jest.fn() };
    const readSession = jest.fn(async () => null);

    await expect(
      navigateFromNotificationData(VALID_PAYLOAD, router, readSession)
    ).resolves.toBe("no_session");
    await expect(
      navigateFromNotificationData({ url: "https://example.test" }, router, readSession)
    ).resolves.toBe("invalid_payload");

    expect(readSession).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("recebimento e interação", () => {
  it("trata recebimento em primeiro plano sem navegar antes do clique", () => {
    const router = { push: jest.fn() };
    const onReceived = jest.fn();
    const stop = startPushNavigation(router, { onReceived });
    const state = getMockState();

    state.received({ request: { content: { data: VALID_PAYLOAD } } });

    expect(onReceived).toHaveBeenCalledWith(VALID_PAYLOAD);
    expect(router.push).not.toHaveBeenCalled();
    stop();
    expect(state.received).toBeNull();
    expect(state.response).toBeNull();
  });

  it("abre o evento do response inicial quando o app é iniciado pelo push", async () => {
    const router = { push: jest.fn() };
    const state = getMockState();
    state.lastResponse = makeResponse(VALID_PAYLOAD);

    const stop = startPushNavigation(router, {
      readSession: async () => ({ token: "token-sintetico", user: { id: "usuario-teste" } }),
    });

    await flushAsyncWork();

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(routeForMachineEventPush(VALID_PAYLOAD));
    expect(state.clearCount).toBe(1);
    stop();
  });

  it("não abre rota para clique com payload inválido", async () => {
    const router = { push: jest.fn() };
    const state = getMockState();
    const onResponse = jest.fn();

    const stop = startPushNavigation(router, {
      readSession: async () => ({ token: "token-sintetico", user: { id: "usuario-teste" } }),
      onResponse,
    });
    state.response(makeResponse({ url: "https://example.test" }));

    await flushAsyncWork();

    expect(router.push).not.toHaveBeenCalled();
    expect(onResponse).toHaveBeenCalledWith("invalid_payload");
    stop();
  });
});

describe("evento autorizado", () => {
  it("só seleciona o evento com ID, máquina e categoria do payload", () => {
    expect(findAuthorizedMachineEvent([MACHINE_EVENT], VALID_PAYLOAD)).toEqual(MACHINE_EVENT);
    expect(
      findAuthorizedMachineEvent(
        [{ ...MACHINE_EVENT, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
        VALID_PAYLOAD
      )
    ).toBeNull();
    expect(
      findAuthorizedMachineEvent(
        [{ ...MACHINE_EVENT, machineId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
        VALID_PAYLOAD
      )
    ).toBeNull();
    expect(
      findAuthorizedMachineEvent(
        [{ ...MACHINE_EVENT, eventType: "warning" }],
        VALID_PAYLOAD
      )
    ).toBeNull();
  });
});
