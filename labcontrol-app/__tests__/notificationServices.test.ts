import { getPlants } from "../lib/plants";
import { apiFetch } from "../services/api";
import { getMachinesByPlant } from "../services/machineService";
import { getAllMachineEvents } from "../services/notificationServices";

jest.mock("../lib/plants", () => ({
  getPlants: jest.fn(),
}));

jest.mock("../services/machineService", () => ({
  getMachinesByPlant: jest.fn(),
}));

jest.mock("../services/api", () => ({
  apiFetch: jest.fn(),
}));

const getPlantsMock = getPlants as jest.MockedFunction<typeof getPlants>;
const getMachinesByPlantMock = getMachinesByPlant as jest.MockedFunction<
  typeof getMachinesByPlant
>;
const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("getAllMachineEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads real events for the user's plants and adds machine names", async () => {
    getPlantsMock.mockResolvedValue([
      {
        id: "plant-1",
        userId: "user-1",
        name: "Lab A",
        description: "",
        scale: 1,
        widthUnits: 100,
        heightUnits: 100,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    getMachinesByPlantMock.mockResolvedValue([
      { id: "machine-1", plantId: "plant-1", name: "Torno" },
    ]);
    apiFetchMock.mockResolvedValue([
      {
        id: "event-1",
        machineId: "machine-1",
        eventType: "failure",
        message: "Vibração detectada",
        createdAt: "2026-11-05T12:00:00.000Z",
      },
    ]);

    await expect(getAllMachineEvents()).resolves.toMatchObject([
      {
        id: "event-1",
        machineName: "Torno",
        message: "Vibração detectada",
      },
    ]);
    expect(getPlantsMock).toHaveBeenCalledTimes(1);
    expect(getMachinesByPlantMock).toHaveBeenCalledWith("plant-1");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/machine-events/machine/machine-1"
    );
  });
});
