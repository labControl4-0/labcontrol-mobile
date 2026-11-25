// O que o mapa desenha. Converte posição atual, máquinas e ocorrências em
// pontos simples (cor, rótulo, detalhe), iguais para Android/iOS e Web.
import { formatAccuracy, formatCoordinates, formatDistance, type Coordinates } from "./distance";
import type { LocatedMachine } from "./machineGeo";

export type MapPointKind = "me" | "machine" | "sample" | "occurrence";

export type MapPoint = Coordinates & {
  id: string;
  kind: MapPointKind;
  color: string;
  /** Título do popup. Sempre exibido como texto puro (nunca como HTML). */
  label: string;
  /** Linhas extras do popup, separadas por "\n". */
  detail: string;
  /** Círculo de precisão, em metros (só para a posição atual). */
  radiusMeters: number | null;
};

/** Pedido para centralizar o mapa. Mudar `key` recentraliza mesmo no mesmo ponto. */
export type MapFocus = Coordinates & { zoom: number; key: number };

export type MapData = {
  points: MapPoint[];
  focus: MapFocus | null;
};

export const STATUS_COLOR: Record<string, string> = {
  active: "#16A34A",
  warning: "#F59E0B",
  error: "#DC2626",
  idle: "#9CA3AF",
};

export const STATUS_LABEL: Record<string, string> = {
  active: "Ativo",
  warning: "Atenção",
  error: "Erro",
  idle: "Inativo",
};

export const MAP_COLORS = {
  me: "#2563EB",
  occurrence: "#7C3AED",
  /** Máquina sem status conhecido: vermelho, como os pontos salvos do material de referência. */
  machine: "#DC2626",
} as const;

export const SOURCE_LABEL = {
  api: "Posição cadastrada na API",
  device: "Posição fixada neste aparelho",
  sample: "Máquina de exemplo (dados fictícios)",
} as const;

/** Círculos de precisão maiores que isso poluem o mapa e não ajudam. */
const MAX_ACCURACY_CIRCLE_M = 2000;

export type HerePosition = Coordinates & { accuracy: number | null };

export function herePoint(here: HerePosition): MapPoint {
  return {
    id: "me",
    kind: "me",
    latitude: here.latitude,
    longitude: here.longitude,
    color: MAP_COLORS.me,
    label: "Você está aqui",
    detail: `${formatCoordinates(here)}\nPrecisão: ${formatAccuracy(here.accuracy)}`,
    radiusMeters:
      typeof here.accuracy === "number" && here.accuracy > 0 && here.accuracy <= MAX_ACCURACY_CIRCLE_M
        ? here.accuracy
        : null,
  };
}

export function machinePoint(machine: LocatedMachine): MapPoint {
  const status = machine.status ?? "";
  const lines = [
    [STATUS_LABEL[status] ?? "Status desconhecido", machine.plantName].filter(Boolean).join(" · "),
    machine.distanceMeters !== null ? `${formatDistance(machine.distanceMeters)} de você (linha reta)` : null,
    SOURCE_LABEL[machine.source],
  ].filter(Boolean);

  return {
    id: `machine:${machine.id}`,
    kind: machine.source === "sample" ? "sample" : "machine",
    latitude: machine.latitude,
    longitude: machine.longitude,
    color: STATUS_COLOR[status] ?? MAP_COLORS.machine,
    label: machine.source === "sample" ? `${machine.name} (exemplo)` : machine.name,
    detail: lines.join("\n"),
    radiusMeters: null,
  };
}

export function occurrencePoint(input: Coordinates & {
  id: string;
  label: string;
  accuracy: number | null;
}): MapPoint {
  return {
    id: `occurrence:${input.id}`,
    kind: "occurrence",
    latitude: input.latitude,
    longitude: input.longitude,
    color: MAP_COLORS.occurrence,
    label: input.label,
    detail: `Local do registro da ocorrência\n${formatCoordinates(input)}\nPrecisão: ${formatAccuracy(input.accuracy)}`,
    radiusMeters: null,
  };
}

export function buildMapPoints(input: {
  here: HerePosition | null;
  machines: LocatedMachine[];
  extra?: MapPoint[];
}): MapPoint[] {
  return [
    ...input.machines.map(machinePoint),
    ...(input.extra ?? []),
    // Por último, para ficar por cima dos outros marcadores.
    ...(input.here ? [herePoint(input.here)] : []),
  ];
}
