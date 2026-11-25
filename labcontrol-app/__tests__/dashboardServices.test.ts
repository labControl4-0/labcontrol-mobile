import { getDashboardData } from "../services/dasbhoardServices";
import { getMachinesByPlantCached, getPlantsCached } from "../services/catalogService";
import { getMachineEvents } from "../services/notificationServices";

jest.mock("../services/catalogService");
jest.mock("../services/notificationServices");

const plants = jest.mocked(getPlantsCached);
const machines = jest.mocked(getMachinesByPlantCached);
const events = jest.mocked(getMachineEvents);

beforeEach(() => {
  jest.resetAllMocks();
  plants.mockResolvedValue({ data: [{ id: "plant-1", name: "Lab A" }], source: "network" } as Awaited<ReturnType<typeof getPlantsCached>>);
  machines.mockResolvedValue({ data: [{ id: "machine-1", plantId: "plant-1", name: "Torno" }], source: "cache", cachedAt: "2026-11-05T12:00:00.000Z" } as Awaited<ReturnType<typeof getMachinesByPlantCached>>);
});

it("associa o evento à máquina e à planta e informa a data do cache", async () => {
  events.mockResolvedValue([{
    id: "event-1", machineId: "machine-1", eventType: "failure", message: "Vibração",
    createdAt: "2026-11-05T12:00:00.000Z", resolvedAt: null,
  }]);
  await expect(getDashboardData()).resolves.toMatchObject({
    machines: [{ id: "machine-1", plantName: "Lab A" }],
    events: [{ id: "event-1", machineName: "Torno", plantId: "plant-1" }],
    cachedCatalogAt: "2026-11-05T12:00:00.000Z",
  });
});

it("distingue falha na consulta de eventos de uma lista vazia", async () => {
  events.mockRejectedValue(new Error("Eventos indisponíveis"));
  await expect(getDashboardData()).resolves.toMatchObject({
    events: null,
    eventsError: "Eventos indisponíveis",
  });
});

it("propaga falhas do catálogo", async () => {
  machines.mockRejectedValue(new Error("Falha ao carregar máquinas"));
  await expect(getDashboardData()).rejects.toThrow("Falha ao carregar máquinas");
});
