// Máquinas no mapa: origem da coordenada, distância, ordenação e máquinas de exemplo.
import { haversineDistanceMeters } from "../lib/geo/distance";
import {
  buildMachineGeoView,
  nearestMachine,
  readApiCoordinates,
  type CatalogEntry,
  type PinnedLocation,
} from "../lib/geo/machineGeo";
import {
  buildSampleMachines,
  DEFAULT_SAMPLE_ANCHOR,
  isSampleMachineId,
  SAMPLE_MACHINE_SPECS,
  SAMPLE_PLANT,
} from "../lib/geo/sampleMachines";

const HERE = { latitude: -23.5003, longitude: -47.4582 };

const catalog: CatalogEntry[] = [
  // Coordenada vinda da API (futuro BE): tem prioridade sobre a fixada no aparelho.
  { machine: { id: "m-api", name: "Prensa", status: "active", latitude: -23.5004, longitude: -47.4583 }, plantName: "Lab A" },
  // Coordenada da API como texto também é aceita.
  { machine: { id: "m-str", name: "Serra", status: "warning", latitude: "-23.5010", longitude: "-47.4590" }, plantName: "Lab A" },
  // Coordenada inválida da API cai para a posição fixada.
  { machine: { id: "m-pin", name: "Torno", status: "error", latitude: 999, longitude: 0 }, plantName: "Lab B" },
  // Sem coordenada nenhuma.
  { machine: { id: "m-none", name: "Estufa", status: "idle" }, plantName: "Lab B" },
  { machine: { id: "m-none-2", name: "  ", status: null }, plantName: null },
];

const pinned: PinnedLocation[] = [
  {
    machineId: "m-pin",
    machineName: "Torno",
    plantId: "p-b",
    latitude: -23.52,
    longitude: -47.47,
    accuracy: 12,
    capturedAt: "2026-11-16T13:00:00.000Z",
  },
  {
    machineId: "m-api",
    machineName: "Prensa",
    plantId: "p-a",
    latitude: 10,
    longitude: 10,
    accuracy: 3,
    capturedAt: "2026-11-16T13:00:00.000Z",
  },
];

describe("readApiCoordinates", () => {
  it("aceita número ou texto numérico e recusa o resto", () => {
    expect(readApiCoordinates({ id: "a", latitude: -23.5, longitude: -47.4 })).toEqual({ latitude: -23.5, longitude: -47.4 });
    expect(readApiCoordinates({ id: "a", latitude: "-23.5", longitude: "-47.4" })).toEqual({ latitude: -23.5, longitude: -47.4 });
    expect(readApiCoordinates({ id: "a", latitude: "", longitude: "" })).toBeNull();
    expect(readApiCoordinates({ id: "a", latitude: "abc", longitude: 1 })).toBeNull();
    expect(readApiCoordinates({ id: "a", latitude: 91, longitude: 1 })).toBeNull();
    expect(readApiCoordinates({ id: "a" })).toBeNull();
  });
});

describe("buildMachineGeoView", () => {
  it("usa API > aparelho e separa as máquinas sem posição", () => {
    const view = buildMachineGeoView({ catalog, pinned, here: null });

    const byId = Object.fromEntries(view.located.map((m) => [m.id, m]));
    expect(byId["m-api"]).toMatchObject({ source: "api", latitude: -23.5004, longitude: -47.4583, accuracy: null });
    expect(byId["m-str"]).toMatchObject({ source: "api", latitude: -23.501 });
    expect(byId["m-pin"]).toMatchObject({ source: "device", latitude: -23.52, accuracy: 12, plantName: "Lab B" });
    // Ordem alfabética pelo nome exibido: "Estufa" < "m-none-2".
    expect(view.unlocated.map((m) => m.id)).toEqual(["m-none", "m-none-2"]);
    expect(view.unlocated[1].name).toBe("m-none-2"); // nome vazio cai para o id
  });

  it("sem posição atual não calcula distância e ordena por nome", () => {
    const view = buildMachineGeoView({ catalog, pinned, here: null });
    expect(view.located.every((m) => m.distanceMeters === null)).toBe(true);
    expect(view.located.map((m) => m.name)).toEqual(["Prensa", "Serra", "Torno"]);
    expect(nearestMachine(view)).toBeNull();
  });

  it("com posição atual ordena da mais próxima para a mais distante", () => {
    const view = buildMachineGeoView({ catalog, pinned, here: HERE });
    const distances = view.located.map((m) => m.distanceMeters ?? Infinity);

    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(view.located[0].id).toBe("m-api");
    expect(view.located[0].distanceMeters).toBeCloseTo(haversineDistanceMeters(HERE, { latitude: -23.5004, longitude: -47.4583 }), 6);
    expect(nearestMachine(view)?.id).toBe("m-api");
  });

  it("inclui as máquinas de exemplo junto com as reais", () => {
    const samples = buildSampleMachines(HERE);
    const view = buildMachineGeoView({ catalog: [], pinned: [], samples, here: HERE });

    expect(view.located).toHaveLength(SAMPLE_MACHINE_SPECS.length);
    expect(view.located.every((m) => m.source === "sample")).toBe(true);
    expect(view.unlocated).toEqual([]);
  });
});

describe("máquinas de exemplo", () => {
  it("são 5, fictícias, válidas e identificadas como exemplo", () => {
    const samples = buildSampleMachines();
    expect(samples).toHaveLength(5);
    for (const sample of samples) {
      expect(isSampleMachineId(sample.id)).toBe(true);
      expect(sample.source).toBe("sample");
      expect(sample.plantId).toBe(SAMPLE_PLANT.id);
      expect(sample.model).toMatch(/\(exemplo\)$/);
      expect(["active", "warning", "error", "idle"]).toContain(sample.status);
    }
    expect(new Set(samples.map((s) => s.id)).size).toBe(5);
    expect(isSampleMachineId("3f1c2a9e-0000-4000-8000-000000000001")).toBe(false);
  });

  it("ficam na distância planejada da âncora", () => {
    for (const anchor of [DEFAULT_SAMPLE_ANCHOR, { latitude: 51.5, longitude: -0.12 }]) {
      const samples = buildSampleMachines(anchor);
      SAMPLE_MACHINE_SPECS.forEach((spec, i) => {
        const planned = Math.hypot(spec.northMeters, spec.eastMeters);
        expect(haversineDistanceMeters(anchor, samples[i])).toBeCloseTo(planned, -1);
      });
    }
  });

  it("cobrem todos os status e distâncias em metros e em km", () => {
    const view = buildMachineGeoView({
      catalog: [],
      pinned: [],
      samples: buildSampleMachines(HERE),
      here: HERE,
    });
    expect(new Set(view.located.map((m) => m.status))).toEqual(new Set(["active", "warning", "error", "idle"]));
    expect(view.located[0].distanceMeters).toBeLessThan(100);
    expect(view.located[view.located.length - 1].distanceMeters).toBeGreaterThan(1000);
  });
});
