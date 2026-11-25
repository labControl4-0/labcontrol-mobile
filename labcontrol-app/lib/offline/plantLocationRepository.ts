// Fila local por usuário para coordenadas de plantas capturadas explicitamente.
import { getDatabase } from "./database";

export type PlantLocationDraft = {
  userId: string;
  plantId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
};

function assertCoordinates(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Latitude fora do intervalo válido.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Longitude fora do intervalo válido.");
  }
}

export async function savePlantLocationDraft(draft: PlantLocationDraft): Promise<void> {
  if (!draft.userId || !draft.plantId) throw new Error("Usuário e planta são obrigatórios.");
  assertCoordinates(draft.latitude, draft.longitude);
  if (draft.accuracyMeters != null && (!Number.isFinite(draft.accuracyMeters) || draft.accuracyMeters < 0)) {
    throw new Error("Precisão inválida.");
  }

  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO plant_location_drafts
      (user_id, plant_id, latitude, longitude, accuracy_m, captured_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [draft.userId, draft.plantId, draft.latitude, draft.longitude, draft.accuracyMeters, draft.capturedAt]
  );
}

export async function getPlantLocationDrafts(userId: string): Promise<PlantLocationDraft[]> {
  if (!userId) return [];
  const db = await getDatabase();
  return db.getAllAsync<PlantLocationDraft>(
    `SELECT user_id AS userId, plant_id AS plantId, latitude, longitude,
            accuracy_m AS accuracyMeters, captured_at AS capturedAt
       FROM plant_location_drafts
      WHERE user_id = ?
      ORDER BY captured_at ASC`,
    [userId]
  );
}

export async function removePlantLocationDraft(userId: string, plantId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "DELETE FROM plant_location_drafts WHERE user_id = ? AND plant_id = ?",
    [userId, plantId]
  );
}
