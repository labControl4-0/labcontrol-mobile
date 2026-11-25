// Junta as máquinas da API com as coordenadas conhecidas e calcula a distância
// até o usuário. Funções puras, testáveis sem tela.
//
// De onde vem a coordenada de uma máquina (nesta ordem de prioridade):
//   1. "api":    a própria API devolveu latitude/longitude (quando o backend
//                tiver esses campos; hoje Machine só tem posX/posY da planta).
//   2. "device": o usuário fixou a posição no aparelho ("Fixar aqui").
//   3. "sample": máquina de exemplo, só para demonstração.
//
// A coordenada é do EQUIPAMENTO. A posição do técnico ao registrar uma
// ocorrência é outro dado e fica na própria ocorrência.
import { haversineDistanceMeters, isValidCoordinates, type Coordinates } from "./distance";

export type LocationSource = "api" | "device" | "sample";

export type GeoMachine = Coordinates & {
  id: string;
  name: string;
  model: string | null;
  status: string | null;
  plantId: string | null;
  plantName: string | null;
  sectorId: string | null;
  accuracy: number | null;
  source: LocationSource;
};

export type LocatedMachine = GeoMachine & {
  /** Distância em linha reta até o usuário, ou null sem posição atual. */
  distanceMeters: number | null;
};

/** Máquina como vem de GET /machines/plant/{plantId}. Campos extras são ignorados. */
export type CatalogMachine = {
  id: string;
  name?: string | null;
  model?: string | null;
  status?: string | null;
  plantId?: string | null;
  sectorId?: string | null;
  latitude?: unknown;
  longitude?: unknown;
};

export type CatalogEntry = {
  machine: CatalogMachine;
  plantName: string | null;
};

/** Posição de máquina fixada no aparelho (tabela machine_locations). */
export type PinnedLocation = Coordinates & {
  machineId: string;
  machineName: string;
  plantId: string | null;
  accuracy: number | null;
  capturedAt: string;
};

export type UnlocatedMachine = {
  id: string;
  name: string;
  plantId: string | null;
  plantName: string | null;
};

export type MachineGeoView = {
  located: LocatedMachine[];
  unlocated: UnlocatedMachine[];
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/** Coordenadas enviadas pela API, se existirem e forem válidas. */
export function readApiCoordinates(machine: CatalogMachine): Coordinates | null {
  const candidate = {
    latitude: toNumber(machine.latitude),
    longitude: toNumber(machine.longitude),
  };
  return isValidCoordinates(candidate) ? candidate : null;
}

const displayName = (m: CatalogMachine) => (m.name && m.name.trim()) || m.id;

export function buildMachineGeoView(input: {
  catalog: CatalogEntry[];
  pinned: PinnedLocation[];
  samples?: GeoMachine[];
  here: Coordinates | null;
}): MachineGeoView {
  const pinnedById = new Map(input.pinned.map((p) => [p.machineId, p]));
  const located: GeoMachine[] = [];
  const unlocated: UnlocatedMachine[] = [];

  for (const { machine, plantName } of input.catalog) {
    const base = {
      id: machine.id,
      name: displayName(machine),
      model: machine.model ?? null,
      status: machine.status ?? null,
      plantId: machine.plantId ?? null,
      plantName,
      sectorId: machine.sectorId ?? null,
    };

    const fromApi = readApiCoordinates(machine);
    if (fromApi) {
      located.push({ ...base, ...fromApi, accuracy: null, source: "api" });
      continue;
    }

    const pinned = pinnedById.get(machine.id);
    if (pinned && isValidCoordinates(pinned)) {
      located.push({
        ...base,
        latitude: pinned.latitude,
        longitude: pinned.longitude,
        accuracy: pinned.accuracy,
        source: "device",
      });
      continue;
    }

    unlocated.push({ id: machine.id, name: base.name, plantId: base.plantId, plantName });
  }

  for (const sample of input.samples ?? []) {
    if (isValidCoordinates(sample)) located.push(sample);
  }

  const withDistance: LocatedMachine[] = located.map((m) => ({
    ...m,
    distanceMeters: input.here ? haversineDistanceMeters(input.here, m) : null,
  }));

  withDistance.sort((a, b) => {
    if (a.distanceMeters !== null && b.distanceMeters !== null) {
      return a.distanceMeters - b.distanceMeters;
    }
    return a.name.localeCompare(b.name, "pt-BR");
  });

  unlocated.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { located: withDistance, unlocated };
}

/** Máquina mais próxima do usuário, se houver posição atual. */
export function nearestMachine(view: MachineGeoView): LocatedMachine | null {
  const first = view.located[0];
  return first && first.distanceMeters !== null ? first : null;
}
