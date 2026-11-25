import { apiFetch } from "../services/api";
import { getDashboardData } from "../services/dasbhoardServices";

jest.mock("../services/api", () => ({
  apiFetch: jest.fn(),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("getDashboardData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregates values returned by the API", async () => {
    apiFetchMock.mockImplementation(async (path) => {
      switch (path) {
        case "/users":
          return [{ id: "user-1" }, { id: "user-2" }];
        case "/plants":
          return [{ id: "plant-1", name: "Lab A" }];
        case "/machines/plant/plant-1":
          return [{ id: "machine-1", name: "Torno" }];
        case "/machine-metrics/machine/machine-1":
          return [
            { machineId: "machine-1", energyConsumption: 120, temperature: 24 },
            { machineId: "machine-1", energy: 80, temp: 28 },
          ];
        case "/machine-events/machine/machine-1":
          return [
            { id: "event-1", machineId: "machine-1", resolved: false },
            { id: "event-2", machineId: "machine-1", resolved: true },
          ];
        default:
          throw new Error(`Unexpected API path: ${path}`);
      }
    });

    await expect(getDashboardData()).resolves.toMatchObject({
      totalEnergy: 200,
      avgTemp: 26,
      registeredUsers: 2,
      activeAlerts: 1,
      metrics: [
        { machineName: "Torno", energyConsumption: 120 },
        { machineName: "Torno", energy: 80 },
      ],
    });
  });

  it("surfaces API errors instead of replacing failed requests with empty data", async () => {
    apiFetchMock.mockImplementation(async (path) => {
      if (path === "/users") return [];
      if (path === "/plants") return [{ id: "plant-1" }];
      if (path === "/machines/plant/plant-1") {
        throw new Error("Falha ao carregar máquinas");
      }
      throw new Error(`Unexpected API path: ${path}`);
    });

    await expect(getDashboardData()).rejects.toThrow(
      "Falha ao carregar máquinas"
    );
  });
});
