// Máquinas de EXEMPLO para demonstrar o mapa sem depender do backend.
//
// Dados fictícios. Ficam só na memória do app, nunca são enviados à API e
// sempre aparecem marcados como "Exemplo". As posições são deslocamentos em
// metros a partir de uma âncora: a posição atual do usuário (se já obtida) ou
// o ponto fictício usado no material de referência.
import { offsetCoordinates, type Coordinates } from "./distance";
import type { GeoMachine } from "./machineGeo";

/** Ponto fictício do material de referência (Expo e Java: Geolocalização e Mapas). */
export const DEFAULT_SAMPLE_ANCHOR: Coordinates = { latitude: -23.5003, longitude: -47.4582 };

export const SAMPLE_PLANT = { id: "demo-plant", name: "Laboratório de exemplo" } as const;

const SAMPLE_ID_PREFIX = "demo-";

type SampleSpec = {
  id: string;
  name: string;
  model: string;
  status: "active" | "warning" | "error" | "idle";
  northMeters: number;
  eastMeters: number;
};

export const SAMPLE_MACHINE_SPECS: readonly SampleSpec[] = [
  { id: "demo-torno-cnc", name: "Torno CNC 01", model: "TCN-200", status: "active", northMeters: 40, eastMeters: 25 },
  { id: "demo-fresadora", name: "Fresadora Universal", model: "FU-45", status: "warning", northMeters: -35, eastMeters: 60 },
  { id: "demo-impressora-3d", name: "Impressora 3D", model: "P3D-X", status: "active", northMeters: 120, eastMeters: -80 },
  { id: "demo-compressor", name: "Compressor de Ar", model: "CA-10", status: "error", northMeters: -150, eastMeters: -40 },
  { id: "demo-estufa", name: "Estufa de Secagem", model: "ES-300", status: "idle", northMeters: 600, eastMeters: 900 },
];

export function isSampleMachineId(id: string): boolean {
  return id.startsWith(SAMPLE_ID_PREFIX);
}

export function buildSampleMachines(anchor: Coordinates = DEFAULT_SAMPLE_ANCHOR): GeoMachine[] {
  return SAMPLE_MACHINE_SPECS.map((spec) => ({
    ...offsetCoordinates(anchor, spec.northMeters, spec.eastMeters),
    id: spec.id,
    name: spec.name,
    model: `${spec.model} (exemplo)`,
    status: spec.status,
    plantId: SAMPLE_PLANT.id,
    plantName: SAMPLE_PLANT.name,
    sectorId: null,
    accuracy: null,
    source: "sample" as const,
  }));
}
