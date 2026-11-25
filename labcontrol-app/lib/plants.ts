import { apiFetch } from "../services/api";
import type { Plant } from "../types/plant";

export async function getPlants(): Promise<Plant[]> {
  return apiFetch("/plants");
}
export async function updatePlantLocation(
  plantId: string,
  latitude: number,
  longitude: number
): Promise<Plant> {
  return apiFetch(`/plants/${encodeURIComponent(plantId)}/location`, {
    method: "PUT",
    body: JSON.stringify({ latitude, longitude }),
  });
}
