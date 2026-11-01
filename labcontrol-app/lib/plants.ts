import { apiFetch } from "../services/api";
import type { Plant } from "../types/plant";

export async function getPlants(): Promise<Plant[]> {
  return apiFetch("/plants");
}
