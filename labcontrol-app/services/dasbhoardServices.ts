

import { apiFetch } from "./api";

type User = {
  id: string;
  name?: string;
  email?: string;
};

type Plant = {
  id: string;
  name?: string;
};

type Machine = {
  id: string;
  name?: string;
  plantId?: string;
};

type MachineMetric = {
  id?: string;
  machineId?: string;
  temperature?: number;
  temp?: number;
  energyConsumption?: number;
  energy?: number;
  power?: number;
  createdAt?: string;
};

type MachineEvent = {
  id: string;
  machineId?: string;
  title?: string;
  description?: string;
  resolved?: boolean;
  isResolved?: boolean;
  createdAt?: string;
};

export type DashboardData = {
  totalEnergy: number;
  avgTemp: number;
  registeredUsers: number;
  activeAlerts: number;
  metrics: MachineMetric[];
  events: MachineEvent[];
};

function getMetricEnergy(metric: MachineMetric) {
  return metric.energyConsumption ?? metric.energy ?? metric.power ?? 0;
}

function getMetricTemperature(metric: MachineMetric) {
  return metric.temperature ?? metric.temp ?? null;
}

function isEventActive(event: MachineEvent) {
  if (typeof event.resolved === "boolean") {
    return !event.resolved;
  }

  if (typeof event.isResolved === "boolean") {
    return !event.isResolved;
  }

  return true;
}

export async function getDashboardData(): Promise<DashboardData> {
  const users = (await apiFetch("/users")) as User[];
  const plants = (await apiFetch("/plants")) as Plant[];

  if (!plants.length) {
    return {
      totalEnergy: 0,
      avgTemp: 0,
      registeredUsers: users.length,
      activeAlerts: 0,
      metrics: [],
      events: [],
    };
  }

  const machinesResults = await Promise.all(
    plants.map((plant) =>
      apiFetch(`/machines/plant/${plant.id}`).catch((error) => {
        console.log(`Erro ao buscar máquinas da planta ${plant.id}:`, error.message);
        return [];
      })
    )
  );

  const machines = machinesResults.flat() as Machine[];

  if (!machines.length) {
    return {
      totalEnergy: 0,
      avgTemp: 0,
      registeredUsers: users.length,
      activeAlerts: 0,
      metrics: [],
      events: [],
    };
  }

  const metricsResults = await Promise.all(
    machines.map((machine) =>
      apiFetch(`/machine-metrics/machine/${machine.id}`).catch((error) => {
        console.log(`Erro ao buscar métricas da máquina ${machine.id}:`, error.message);
        return [];
      })
    )
  );

  const eventsResults = await Promise.all(
    machines.map((machine) =>
      apiFetch(`/machine-events/machine/${machine.id}`).catch((error) => {
        console.log(`Erro ao buscar eventos da máquina ${machine.id}:`, error.message);
        return [];
      })
    )
  );

  const metrics = metricsResults.flat() as MachineMetric[];
  const events = eventsResults.flat() as MachineEvent[];

  const totalEnergy = metrics.reduce(
    (sum, metric) => sum + getMetricEnergy(metric),
    0
  );

  const temperatures = metrics
    .map(getMetricTemperature)
    .filter((value): value is number => typeof value === "number");

  const avgTemp =
    temperatures.length > 0
      ? temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length
      : 0;

  const activeAlerts = events.filter(isEventActive).length;

  return {
    totalEnergy,
    avgTemp,
    registeredUsers: users.length,
    activeAlerts,
    metrics,
    events,
  };
}