// Posição atual via expo-location: permissão, GPS desligado, timeout e dados ruins.
import * as Location from "expo-location";

import { getCurrentPosition, LocationError } from "../lib/geo/location";

jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const mocked = Location as unknown as {
  requestForegroundPermissionsAsync: jest.Mock;
  hasServicesEnabledAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

const FIX = {
  coords: { latitude: -23.5003, longitude: -47.4582, accuracy: 8.5 },
  timestamp: Date.UTC(2026, 10, 16, 13, 5, 0),
};

function grant() {
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
  mocked.hasServicesEnabledAsync.mockResolvedValue(true);
}

async function expectCode(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e) => e);
  expect(error).toBeInstanceOf(LocationError);
  expect((error as LocationError).code).toBe(code);
  return error as LocationError;
}

beforeEach(() => {
  jest.resetAllMocks();
});

it("devolve latitude, longitude, precisão e horário quando a permissão é concedida", async () => {
  grant();
  mocked.getCurrentPositionAsync.mockResolvedValue(FIX);

  await expect(getCurrentPosition()).resolves.toEqual({
    latitude: -23.5003,
    longitude: -47.4582,
    accuracy: 8.5,
    timestamp: "2026-11-16T13:05:00.000Z",
  });
  expect(mocked.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 4 });
});

it("permissão negada não chama o GPS", async () => {
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: true });

  const error = await expectCode(getCurrentPosition(), "denied");
  expect(error.message).toMatch(/negada/);
  expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it("permissão bloqueada orienta a liberar nas configurações", async () => {
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied", canAskAgain: false });

  const error = await expectCode(getCurrentPosition(), "blocked");
  expect(error.message).toMatch(/configurações/);
});

it("falha ao pedir permissão vira erro amigável", async () => {
  mocked.requestForegroundPermissionsAsync.mockRejectedValue(new Error("native crash"));
  const error = await expectCode(getCurrentPosition(), "unavailable");
  expect(error.message).not.toMatch(/native crash/);
});

it("GPS desligado é informado sem tentar ler a posição", async () => {
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
  mocked.hasServicesEnabledAsync.mockResolvedValue(false);

  const error = await expectCode(getCurrentPosition(), "unavailable");
  expect(error.message).toMatch(/GPS desligado/);
  expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
});

it("se a checagem do GPS não existir (web), segue para a leitura", async () => {
  mocked.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted", canAskAgain: true });
  mocked.hasServicesEnabledAsync.mockRejectedValue(new Error("not available on web"));
  mocked.getCurrentPositionAsync.mockResolvedValue(FIX);

  await expect(getCurrentPosition()).resolves.toMatchObject({ latitude: -23.5003 });
});

it("desiste depois do tempo limite", async () => {
  grant();
  mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));

  const error = await expectCode(getCurrentPosition({ timeoutMs: 30 }), "timeout");
  expect(error.message).toMatch(/demorou mais de/);
});

it("o tempo limite padrão é de 20 segundos", async () => {
  jest.useFakeTimers();
  try {
    grant();
    mocked.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined));
    const pending = getCurrentPosition().catch((e) => e);

    await jest.advanceTimersByTimeAsync(19_999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const error = await pending;
    expect(error).toBeInstanceOf(LocationError);
    expect(error.code).toBe("timeout");
  } finally {
    jest.useRealTimers();
  }
});

it("erro do GPS vira 'unavailable' com mensagem segura", async () => {
  grant();
  mocked.getCurrentPositionAsync.mockRejectedValue(new Error("kCLErrorDomain 0"));

  const error = await expectCode(getCurrentPosition(), "unavailable");
  expect(error.message).not.toMatch(/kCLError/);
});

it("coordenada fora da faixa é rejeitada", async () => {
  grant();
  mocked.getCurrentPositionAsync.mockResolvedValue({
    ...FIX,
    coords: { latitude: 123, longitude: -47.4582, accuracy: 5 },
  });

  await expectCode(getCurrentPosition(), "unavailable");
});

it.each([null, -1, Number.NaN])("precisão %s vira null", async (accuracy) => {
  grant();
  mocked.getCurrentPositionAsync.mockResolvedValue({ ...FIX, coords: { ...FIX.coords, accuracy } });

  await expect(getCurrentPosition()).resolves.toMatchObject({ accuracy: null });
});
