// Posição atual do aparelho via expo-location.
//
// Só é chamada por ação explícita do usuário (botão "Minha localização",
// "Fixar aqui" ou o interruptor da ocorrência). Nada roda em segundo plano.
import * as Location from "expo-location";

import { isValidCoordinates, type Coordinates } from "./distance";

export type GeoPosition = Coordinates & {
  /** Precisão horizontal estimada, em metros. null quando o aparelho não informa. */
  accuracy: number | null;
  /** Momento da medição (ISO). */
  timestamp: string;
};

export type LocationErrorCode = "denied" | "blocked" | "unavailable" | "timeout";

/** Erro de localização. `message` é sempre seguro para exibir ao usuário. */
export class LocationError extends Error {
  code: LocationErrorCode;

  constructor(message: string, code: LocationErrorCode) {
    super(message);
    Object.setPrototypeOf(this, LocationError.prototype);
    this.name = "LocationError";
    this.code = code;
  }
}

/** Tempo máximo de espera pelo GPS, como no material de referência. */
export const LOCATION_TIMEOUT_MS = 20_000;

function toIso(timestamp: unknown): string {
  const date = new Date(typeof timestamp === "number" ? timestamp : Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export async function getCurrentPosition(
  options: { timeoutMs?: number } = {}
): Promise<GeoPosition> {
  const timeoutMs = options.timeoutMs ?? LOCATION_TIMEOUT_MS;

  let permission: Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>;
  try {
    permission = await Location.requestForegroundPermissionsAsync();
  } catch {
    throw new LocationError("Não foi possível pedir a permissão de localização.", "unavailable");
  }

  if (permission.status !== "granted") {
    throw permission.canAskAgain === false
      ? new LocationError(
          "Localização bloqueada. Libere o acesso nas configurações do aparelho.",
          "blocked"
        )
      : new LocationError("Permissão de localização negada.", "denied");
  }

  // Na web essa checagem não existe ou falha: segue e deixa o navegador decidir.
  const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!servicesEnabled) {
    throw new LocationError(
      "GPS desligado. Ative a localização do aparelho e tente de novo.",
      "unavailable"
    );
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new LocationError(
            `A localização demorou mais de ${Math.round(timeoutMs / 1000)} segundos. Tente perto de uma janela ou em local aberto.`,
            "timeout"
          )
        ),
      timeoutMs
    );
  });

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout,
    ]);

    const { latitude, longitude, accuracy } = position.coords;
    if (!isValidCoordinates({ latitude, longitude })) {
      throw new LocationError("O aparelho retornou uma posição inválida.", "unavailable");
    }

    return {
      latitude,
      longitude,
      accuracy:
        typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0
          ? accuracy
          : null,
      timestamp: toIso(position.timestamp),
    };
  } catch (error) {
    if (error instanceof LocationError) throw error;
    throw new LocationError(
      "Não foi possível obter a localização. Verifique se o GPS está ligado.",
      "unavailable"
    );
  } finally {
    clearTimeout(timer);
  }
}
