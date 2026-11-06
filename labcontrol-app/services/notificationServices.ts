import { apiFetch } from "./api";

/** DTO MachineEventResponseDto retornado pela API ASP.NET. */
export type MachineEvent = {
  id: string;
  machineId: string;
  eventType: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
};

export async function getMachineEvents(
  machineId: string
): Promise<MachineEvent[]> {
  return apiFetch("/machine-events/machine/" + machineId);
}

export async function resolveMachineEvent(eventId: string) {
  return apiFetch("/machine-events/" + eventId + "/resolve", {
    method: "PATCH",
  });
}
