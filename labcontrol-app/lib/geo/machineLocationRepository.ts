// Posições de máquinas fixadas no aparelho (tabela machine_locations, schema v3).
//
// Enquanto a API não tiver latitude/longitude em Machine, é aqui que fica a
// coordenada de cada equipamento. Só é gravada pelo botão "Fixar aqui", com o
// usuário parado junto à máquina. Toda consulta filtra pelo usuário.
import { getDatabase } from "../offline/database";
import { isValidCoordinates } from "./distance";
import type { PinnedLocation } from "./machineGeo";

type Row = {
  machine_id: string;
  machine_name: string;
  plant_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
};

const fromRow = (row: Row): PinnedLocation => ({
  machineId: row.machine_id,
  machineName: row.machine_name,
  plantId: row.plant_id,
  latitude: row.latitude,
  longitude: row.longitude,
  accuracy: row.accuracy,
  capturedAt: row.captured_at,
});

export type PinInput = Omit<PinnedLocation, "capturedAt"> & { capturedAt?: string };

/** Grava (ou substitui) a posição da máquina. Rejeita coordenadas fora da faixa. */
export async function saveMachineLocation(userId: string, input: PinInput): Promise<PinnedLocation> {
  if (!userId) throw new Error("Usuário não identificado.");
  if (!input.machineId) throw new Error("Máquina não identificada.");
  if (!isValidCoordinates(input)) {
    throw new Error("Coordenadas inválidas: latitude entre -90 e 90 e longitude entre -180 e 180.");
  }

  const accuracy =
    typeof input.accuracy === "number" && Number.isFinite(input.accuracy) && input.accuracy >= 0
      ? input.accuracy
      : null;
  const capturedAt = input.capturedAt ?? new Date().toISOString();

  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO machine_locations (
       user_id, machine_id, machine_name, plant_id, latitude, longitude, accuracy, captured_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, machine_id) DO UPDATE SET
       machine_name = excluded.machine_name,
       plant_id     = excluded.plant_id,
       latitude     = excluded.latitude,
       longitude    = excluded.longitude,
       accuracy     = excluded.accuracy,
       captured_at  = excluded.captured_at`,
    [
      userId,
      input.machineId,
      input.machineName,
      input.plantId,
      input.latitude,
      input.longitude,
      accuracy,
      capturedAt,
    ]
  );

  return {
    machineId: input.machineId,
    machineName: input.machineName,
    plantId: input.plantId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy,
    capturedAt,
  };
}

export async function listMachineLocations(userId: string): Promise<PinnedLocation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Row>(
    `SELECT machine_id, machine_name, plant_id, latitude, longitude, accuracy, captured_at
       FROM machine_locations WHERE user_id = ? ORDER BY machine_name, machine_id`,
    [userId]
  );
  return rows.map(fromRow);
}

/** Remove a posição fixada. Retorna false se não havia nada para remover. */
export async function deleteMachineLocation(userId: string, machineId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "DELETE FROM machine_locations WHERE user_id = ? AND machine_id = ?",
    [userId, machineId]
  );
  return result.changes > 0;
}
