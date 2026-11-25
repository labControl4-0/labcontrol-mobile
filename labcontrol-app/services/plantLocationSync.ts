import { AppState } from "react-native";

import { getAuthSession } from "../lib/auth";
import { getPlantLocationDrafts, removePlantLocationDraft } from "../lib/offline/plantLocationRepository";
import { expoNetworkSource } from "../lib/offline/networkSource";
import { ApiError } from "./api";
import { updatePlantLocation } from "../lib/plants";
import type { ConnectivitySource } from "./occurrenceSync";

const RETRY_INTERVAL_MS = 30_000;
let syncInFlight: Promise<number> | null = null;

/** Envia apenas as posições pendentes do usuário autenticado. PUT é idempotente. */
export function syncPendingPlantLocations(): Promise<number> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const session = await getAuthSession();
    const userId = session?.user.id;
    if (!userId) return 0;

    const drafts = await getPlantLocationDrafts(userId);
    let synced = 0;

    for (const draft of drafts) {
      try {
        await updatePlantLocation(draft.plantId, draft.latitude, draft.longitude);
        await removePlantLocationDraft(userId, draft.plantId);
        synced += 1;
      } catch (error) {
        // Sem rede ou sessão não há ganho em tentar os próximos itens agora.
        if (error instanceof ApiError && ["network", "timeout", "unauthorized"].includes(error.code)) {
          break;
        }
        // Outros erros permanecem na fila para correção ou nova tentativa.
      }
    }

    return synced;
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

/** Tenta a fila ao abrir o app, voltar ao primeiro plano, reconectar e a cada 30 s. */
export function startPlantLocationAutoSync(
  connectivity: ConnectivitySource = expoNetworkSource
): () => void {
  let stopped = false;

  const syncIfConnected = async () => {
    const state = await connectivity.getCurrent().catch(() => null);
    if (stopped || !state?.isConnected || state.isInternetReachable === false) return;
    await syncPendingPlantLocations().catch(() => undefined);
  };

  const unsubscribe = connectivity.subscribe((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void syncPendingPlantLocations().catch(() => undefined);
    }
  });
  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") void syncIfConnected();
  });
  const interval = setInterval(() => void syncIfConnected(), RETRY_INTERVAL_MS);
  void syncIfConnected();

  return () => {
    stopped = true;
    unsubscribe();
    appStateSubscription.remove();
    clearInterval(interval);
  };
}
