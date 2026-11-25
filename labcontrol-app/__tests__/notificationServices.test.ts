import { apiFetch } from "../services/api";
import { getMachineEvents, resolveMachineEvent } from "../services/notificationServices";

jest.mock("../services/api", () => ({ apiFetch: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it("carrega os eventos da máquina pelo contrato da API", async () => {
  const event = {
    id: "event-1", machineId: "machine-1", eventType: "failure", message: "Vibração",
    createdAt: "2026-11-05T12:00:00.000Z", resolvedAt: null,
  };
  jest.mocked(apiFetch).mockResolvedValue([event]);
  await expect(getMachineEvents("machine-1")).resolves.toEqual([event]);
  expect(apiFetch).toHaveBeenCalledWith("/machine-events/machine/machine-1");
});

it("solicita a resolução do evento", async () => {
  jest.mocked(apiFetch).mockResolvedValue(undefined);
  await resolveMachineEvent("event-1");
  expect(apiFetch).toHaveBeenCalledWith("/machine-events/event-1/resolve", { method: "PATCH" });
});
