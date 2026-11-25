import { apiFetch } from "./api";

export type MachineMetric = {
  id: string;
  machineId: string;
  temperature?: number;
  energyConsumption?: number;
  humidity?: number;
  createdAt?: string;
};

export async function getMachineMetrics(
  machineId: string
): Promise<MachineMetric[]> {
  return apiFetch(`/machine-metrics/machine/${machineId}`);
}