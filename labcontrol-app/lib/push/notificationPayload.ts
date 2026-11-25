import type { Href } from "expo-router";

export const PUSH_EVENT_CATEGORIES = [
  "failure",
  "warning",
  "maintenance",
  "note",
] as const;

export type PushEventCategory = (typeof PUSH_EVENT_CATEGORIES)[number];

export type MachineEventPushPayload = {
  categoria: PushEventCategory;
  avisoId: string;
  machineId: string;
  origem: string;
};

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_SET = new Set<string>(PUSH_EVENT_CATEGORIES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Valida o contrato de push antes de aceitar um ID ou navegar.
 * machineId permite consultar a lista autorizada da máquina na API existente.
 */
export function parseMachineEventPushPayload(
  value: unknown
): MachineEventPushPayload | null {
  if (!isRecord(value)) return null;

  const categoria =
    typeof value.categoria === "string" ? value.categoria.trim().toLowerCase() : "";
  const avisoId = typeof value.avisoId === "string" ? value.avisoId.trim() : "";
  const machineId = typeof value.machineId === "string" ? value.machineId.trim() : "";
  const rawOrigin = typeof value.origem === "string" ? value.origem : "";
  const origem = rawOrigin.replace(/[\u0000-\u001f\u007f]/g, "").trim();

  if (!CATEGORY_SET.has(categoria)) return null;
  if (!GUID_PATTERN.test(avisoId) || !GUID_PATTERN.test(machineId)) return null;
  if (origem.length === 0 || origem.length > 120) return null;

  return {
    categoria: categoria as PushEventCategory,
    avisoId: avisoId.toLowerCase(),
    machineId: machineId.toLowerCase(),
    origem,
  };
}

/** Destino fixo do app: payload nunca escolhe uma URL ou rota arbitrária. */
export function routeForMachineEventPush(value: unknown): Href | null {
  const payload = parseMachineEventPushPayload(value);
  if (!payload) return null;

  return {
    pathname: "/NotificationEvent",
    params: {
      categoria: payload.categoria,
      avisoId: payload.avisoId,
      machineId: payload.machineId,
      origem: payload.origem,
    },
  } as any;
}
