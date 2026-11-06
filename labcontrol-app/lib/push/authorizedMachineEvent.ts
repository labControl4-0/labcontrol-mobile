import type { MachineEventPushPayload } from "./notificationPayload";

export type AuthorizedMachineEvent = {
  id: string;
  machineId: string;
  eventType: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
};

/**
 * Seleciona o evento apenas entre os resultados que a API já autorizou
 * para a máquina indicada. IDs e categoria também precisam coincidir.
 */
export function findAuthorizedMachineEvent(
  value: unknown,
  payload: MachineEventPushPayload
): AuthorizedMachineEvent | null {
  if (!Array.isArray(value)) return null;

  const candidate = value.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.id === "string" &&
      row.id.toLowerCase() === payload.avisoId &&
      typeof row.machineId === "string" &&
      row.machineId.toLowerCase() === payload.machineId &&
      typeof row.eventType === "string" &&
      row.eventType.trim().toLowerCase() === payload.categoria &&
      typeof row.message === "string" &&
      typeof row.createdAt === "string"
    );
  });

  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Record<string, unknown>;
  return {
    id: row.id as string,
    machineId: row.machineId as string,
    eventType: row.eventType as string,
    message: row.message as string,
    createdAt: row.createdAt as string,
    resolvedAt: typeof row.resolvedAt === "string" ? row.resolvedAt : null,
  };
}
