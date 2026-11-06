import type { Machine, Plant } from "../types/blueprint";
import {
  getMachinesByPlantCached,
  getPlantsCached,
} from "./catalogService";
import { getMachineEvents, type MachineEvent } from "./notificationServices";

export type DashboardMachine = Machine & {
  plantName: string;
};

export type DashboardEvent = MachineEvent & {
  machineName: string;
  plantName: string;
  plantId: string;
};

export type DashboardData = {
  plants: Plant[];
  machines: DashboardMachine[];
  events: DashboardEvent[] | null;
  eventsError?: string;
  /** Horário em que a tela terminou de consultar os contratos disponíveis. */
  syncedAt: string;
  /** Presente quando pelo menos parte do catálogo veio do cache local. */
  cachedCatalogAt?: string;
};

/**
 * Monta o resumo usando apenas contratos existentes na API .NET:
 * plantas e máquinas com cache; eventos são consultados por máquina. Falhas
 * no catálogo são propagadas, e falhas de eventos são representadas por null.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const cachedDates: string[] = [];
  const track = <T,>(result: { data: T; source: string; cachedAt?: string }) => {
    if (result.source === "cache" && result.cachedAt) cachedDates.push(result.cachedAt);
    return result.data;
  };

  const plantsResult = await getPlantsCached();
  const plants = track(plantsResult) as Plant[];
  const machineGroups = await Promise.all(
    plants.map(async (plant) => ({
      plant,
      machines: track(await getMachinesByPlantCached(plant.id)) as Machine[],
    }))
  );

  const machines: DashboardMachine[] = machineGroups.flatMap(({ plant, machines: items }) =>
    items.map((machine) => ({ ...machine, plantName: plant.name }))
  );

  let events: DashboardEvent[] | null = [];
  let eventsError: string | undefined;

  if (machines.length > 0) {
    try {
      const eventGroups = await Promise.all(
        machines.map((machine) => getMachineEvents(machine.id))
      );
      events = eventGroups.flatMap((items, index) =>
        items.map((event) => ({
          ...event,
          machineName: machines[index].name,
          plantName: machines[index].plantName,
          plantId: machines[index].plantId,
        }))
      );
    } catch (cause) {
      // null significa que a consulta falhou; lista vazia significa sucesso sem eventos.
      events = null;
      eventsError =
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os eventos.";
    }
  }

  return {
    plants,
    machines,
    events,
    eventsError,
    syncedAt: new Date().toISOString(),
    cachedCatalogAt: cachedDates.sort()[0],
  };
}
