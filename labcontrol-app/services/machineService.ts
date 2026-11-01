import { apiFetch } from "./api";

export type Machine = {
  id: string;
  name?: string;
  plantId?: string;
  status?: string;
};

export async function getMachinesByPlant(plantId: string): Promise<Machine[]> {
  return apiFetch(`/machines/plant/${plantId}`);
}