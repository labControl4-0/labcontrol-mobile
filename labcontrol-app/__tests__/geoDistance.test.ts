// Geolocalização: Haversine, validação de faixa e formatação. Dados fictícios.
import {
  EARTH_RADIUS_M,
  formatAccuracy,
  formatCoordinates,
  formatDistance,
  haversineDistanceMeters,
  isValidCoordinates,
  offsetCoordinates,
} from "../lib/geo/distance";

const SE_SP = { latitude: -23.5505, longitude: -46.6333 };
const CENTRO_RJ = { latitude: -22.9068, longitude: -43.1729 };

describe("haversineDistanceMeters", () => {
  it("é zero para o mesmo ponto e simétrica", () => {
    expect(haversineDistanceMeters(SE_SP, SE_SP)).toBe(0);
    expect(haversineDistanceMeters(SE_SP, CENTRO_RJ)).toBeCloseTo(
      haversineDistanceMeters(CENTRO_RJ, SE_SP),
      6
    );
  });

  it("1 grau de latitude vale 2πR/360 metros", () => {
    const expected = (2 * Math.PI * EARTH_RADIUS_M) / 360;
    const d = haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeCloseTo(expected, 3);
  });

  it("São Paulo–Rio em linha reta fica perto de 360 km", () => {
    const km = haversineDistanceMeters(SE_SP, CENTRO_RJ) / 1000;
    expect(km).toBeGreaterThan(355);
    expect(km).toBeLessThan(362);
  });

  it("funciona atravessando o antimeridiano", () => {
    const d = haversineDistanceMeters(
      { latitude: 0, longitude: 179.9 },
      { latitude: 0, longitude: -179.9 }
    );
    expect(d).toBeGreaterThan(22_000);
    expect(d).toBeLessThan(22_400);
  });
});

describe("isValidCoordinates", () => {
  it.each([
    [{ latitude: 90, longitude: 180 }, true],
    [{ latitude: -90, longitude: -180 }, true],
    [{ latitude: -23.5003, longitude: -47.4582 }, true],
    [{ latitude: 90.0001, longitude: 0 }, false],
    [{ latitude: 0, longitude: -180.0001 }, false],
    [{ latitude: Number.NaN, longitude: 0 }, false],
    [{ latitude: Number.POSITIVE_INFINITY, longitude: 0 }, false],
    [{ latitude: "-23.5", longitude: "-47.4" }, false],
    [{ latitude: 10 }, false],
    [null, false],
    [undefined, false],
  ])("%j -> %s", (value, expected) => {
    expect(isValidCoordinates(value)).toBe(expected);
  });
});

describe("formatação", () => {
  it.each([
    [0, "0 m"],
    [849.6, "850 m"],
    [999.4, "999 m"],
    [1000, "1,0 km"],
    [1234, "1,2 km"],
    [9_960, "10,0 km"],
    [15_400, "15 km"],
    [-1, "—"],
    [Number.NaN, "—"],
  ])("formatDistance(%s) = %s", (meters, text) => {
    expect(formatDistance(meters)).toBe(text);
  });

  it("formata coordenadas com 6 casas e precisão em metros", () => {
    expect(formatCoordinates({ latitude: -23.5003, longitude: -47.4582 })).toBe("-23.500300, -47.458200");
    expect(formatAccuracy(8.4)).toBe("±8 m");
    expect(formatAccuracy(null)).toBe("precisão desconhecida");
    expect(formatAccuracy(-3)).toBe("precisão desconhecida");
  });
});

describe("offsetCoordinates", () => {
  it("desloca a distância pedida (3-4-5)", () => {
    const origin = { latitude: -23.5003, longitude: -47.4582 };
    const moved = offsetCoordinates(origin, 300, 400);
    expect(haversineDistanceMeters(origin, moved)).toBeCloseTo(500, 0);
    expect(moved.latitude).toBeGreaterThan(origin.latitude);
    expect(moved.longitude).toBeGreaterThan(origin.longitude);
  });
});
