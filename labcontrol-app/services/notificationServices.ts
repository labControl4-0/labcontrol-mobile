import { apiFetch } from "./api";

export type MachineEvent = {
  id: string;
  machineId: string;
  title?: string;
  description?: string;
  eventType?: string;
  severity?: string;
  resolved?: boolean;
  createdAt?: string;
};

export async function getMachineEvents(
  machineId: string
): Promise<MachineEvent[]> {
  return apiFetch(`/machine-events/machine/${machineId}`);
}

export async function resolveMachineEvent(eventId: string) {
  return apiFetch(`/machine-events/${eventId}/resolve`, {
    method: "PATCH",
  });
}