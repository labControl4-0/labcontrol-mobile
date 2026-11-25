// Cálculos com coordenadas geográficas (latitude/longitude em graus decimais).
// Funções puras, sem dependência de tela ou de módulo nativo.

export type Coordinates = {
  latitude: number;
  longitude: number;
};

/** Raio médio da Terra em metros, usado pela fórmula de Haversine. */
export const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Latitude entre -90 e 90 e longitude entre -180 e 180, ambas números finitos. */
export function isValidCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const { latitude, longitude } = value as Record<string, unknown>;
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Distância em linha reta (Haversine), em metros. Não é a distância pelas
 * ruas nem pelos corredores do prédio.
 */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "850 m", "1,2 km", "15 km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;

  const km = meters / 1000;
  const text = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${text.replace(".", ",")} km`;
}

/** "-23.500300, -47.458200". */
export function formatCoordinates(c: Coordinates, digits = 6): string {
  return `${c.latitude.toFixed(digits)}, ${c.longitude.toFixed(digits)}`;
}

/** "±8 m", ou "precisão desconhecida" quando o aparelho não informa. */
export function formatAccuracy(accuracy: number | null | undefined): string {
  return typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0
    ? `±${Math.round(accuracy)} m`
    : "precisão desconhecida";
}

/**
 * Desloca uma coordenada alguns metros para norte/leste (aproximação local,
 * boa para distâncias de até alguns quilômetros). Usada pelas máquinas de exemplo.
 */
export function offsetCoordinates(
  origin: Coordinates,
  northMeters: number,
  eastMeters: number
): Coordinates {
  const dLat = northMeters / EARTH_RADIUS_M;
  const dLon = eastMeters / (EARTH_RADIUS_M * Math.cos(toRadians(origin.latitude)));

  return {
    latitude: origin.latitude + (dLat * 180) / Math.PI,
    longitude: origin.longitude + (dLon * 180) / Math.PI,
  };
}
