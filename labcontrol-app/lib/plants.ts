import { apiFetch } from "../services/api";
import type { Plant } from "../types/plant";

export type CreatePlantInput = Pick<
  Plant,
  "name" | "description" | "scale" | "widthUnits" | "heightUnits"
>;

export async function getPlants(): Promise<Plant[]> {
  return apiFetch("/plants");
}

export async function createPlant(input: CreatePlantInput): Promise<Plant> {
  return apiFetch("/plants", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
