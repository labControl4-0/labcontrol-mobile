import { apiFetch } from "./api";
import { getPlants } from "../lib/plants";
import { getMachinesByPlant } from "./machineService";

export type MachineEvent = {
  id: string;
  machineId: string;
  machineName?: string;
  title?: string;
  description?: string;
  message?: string;
  eventType?: string;
  severity?: string;
  resolved?: boolean;
  isResolved?: boolean;
  createdAt?: string;
  timestamp?: string;
};

export async function getMachineEvents(
  machineId: string
): Promise<MachineEvent[]> {
  return apiFetch(`/machine-events/machine/${machineId}`);
}

export async function getAllMachineEvents(): Promise<MachineEvent[]> {
  const plants = await getPlants();
  const machines = (
    await Promise.all(plants.map((plant) => getMachinesByPlant(plant.id)))
  ).flat();

  const eventsByMachine = await Promise.all(
    machines.map(async (machine) => {
      const events = await getMachineEvents(machine.id);
      return events.map((event) => ({
        ...event,
        machineName: machine.name ?? machine.id,
      }));
    })
  );

  return eventsByMachine
    .flat()
    .sort((a, b) => {
      const aTime = Date.parse(a.createdAt ?? a.timestamp ?? "");
      const bTime = Date.parse(b.createdAt ?? b.timestamp ?? "");
      const aTimestamp = Number.isFinite(aTime) ? aTime : 0;
      const bTimestamp = Number.isFinite(bTime) ? bTime : 0;
      return bTimestamp - aTimestamp;
    });
}

export async function resolveMachineEvent(eventId: string) {
  return apiFetch(`/machine-events/${eventId}/resolve`, {
    method: "PATCH",
  });
}