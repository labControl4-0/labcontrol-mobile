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
  events: DashboardEvent[];
  /** Horário em que a tela terminou de consultar os contratos disponíveis. */
  syncedAt: string;
  /** Presente quando pelo menos parte do catálogo veio do cache local. */
  cachedCatalogAt?: string;
};

/**
 * Monta o resumo usando apenas contratos existentes na API .NET:
 * plantas, máquinas e eventos por máquina. Qualquer falha de consulta é
 * propagada para a tela; falhas nunca são convertidas em listas vazias.
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

  const eventGroups = await Promise.all(
    machines.map((machine) => getMachineEvents(machine.id))
  );
  const events: DashboardEvent[] = eventGroups.flatMap((items, index) =>
    items.map((event) => ({
      ...event,
      machineName: machines[index].name,
      plantName: machines[index].plantName,
      plantId: machines[index].plantId,
    }))
  );

  return {
    plants,
    machines,
    events,
    syncedAt: new Date().toISOString(),
    cachedCatalogAt: cachedDates.sort()[0],
  };
}
