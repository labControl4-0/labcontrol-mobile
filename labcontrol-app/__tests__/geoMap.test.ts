// O que vai para o mapa Leaflet: pontos, cores, popup seguro e script injetado.
import {
  buildLeafletHtml,
  buildUpdateScript,
  LEAFLET,
  OSM_TILE_URL,
  serializeForScript,
} from "../lib/geo/leafletHtml";
import { buildMachineGeoView } from "../lib/geo/machineGeo";
import {
  buildMapPoints,
  herePoint,
  MAP_COLORS,
  occurrencePoint,
  STATUS_COLOR,
  type MapData,
} from "../lib/geo/mapPoints";
import { buildSampleMachines } from "../lib/geo/sampleMachines";

const HERE = { latitude: -23.5003, longitude: -47.4582, accuracy: 8 };

describe("pontos do mapa", () => {
  const view = buildMachineGeoView({
    catalog: [{ machine: { id: "m-1", name: "Torno", status: "desconhecido", latitude: -23.5, longitude: -47.45 }, plantName: "Lab A" }],
    pinned: [],
    samples: buildSampleMachines(HERE),
    here: HERE,
  });
  const points = buildMapPoints({ here: HERE, machines: view.located });

  it("tem um ponto por máquina e a posição atual por último (por cima)", () => {
    expect(points).toHaveLength(view.located.length + 1);
    expect(points[points.length - 1]).toMatchObject({ id: "me", kind: "me", color: MAP_COLORS.me });
  });

  it("colore pelo status e usa vermelho para status desconhecido", () => {
    const torno = points.find((p) => p.id === "machine:m-1")!;
    expect(torno.color).toBe(MAP_COLORS.machine);
    expect(torno.kind).toBe("machine");

    const fresadora = points.find((p) => p.id === "machine:demo-fresadora")!;
    expect(fresadora.color).toBe(STATUS_COLOR.warning);
    expect(fresadora.kind).toBe("sample");
    expect(fresadora.label).toBe("Fresadora Universal (exemplo)");
    expect(fresadora.detail).toMatch(/de você \(linha reta\)/);
    expect(fresadora.detail).toMatch(/dados fictícios/);
  });

  it("mostra círculo de precisão só quando faz sentido", () => {
    expect(herePoint(HERE).radiusMeters).toBe(8);
    expect(herePoint({ ...HERE, accuracy: null }).radiusMeters).toBeNull();
    expect(herePoint({ ...HERE, accuracy: 5000 }).radiusMeters).toBeNull();
  });

  it("marca a ocorrência em roxo", () => {
    const p = occurrencePoint({ id: "o-1", label: "Ocorrência em Torno", latitude: -23.5, longitude: -47.4, accuracy: 12 });
    expect(p).toMatchObject({ id: "occurrence:o-1", kind: "occurrence", color: MAP_COLORS.occurrence });
    expect(p.detail).toContain("±12 m");
  });
});

describe("script injetado na WebView", () => {
  it("escapa caracteres que poderiam fechar o <script> ou quebrar a string", () => {
    const tricky = `</script><img src=x onerror=alert(1)>&${String.fromCharCode(0x2028, 0x2029)}`;
    const text = serializeForScript({ label: tricky });
    expect(text).not.toMatch(new RegExp("[<>&\u2028\u2029]"));
    expect(JSON.parse(text)).toEqual({ label: tricky });
  });

  it("entrega os dados intactos para window.labcontrolUpdate", () => {
    const data: MapData = {
      points: [herePoint(HERE), occurrencePoint({ id: "o-1", label: 'Nome "estranho" </b>', latitude: 1, longitude: 2, accuracy: null })],
      focus: { latitude: 1, longitude: 2, zoom: 17, key: 3 },
    };
    const received: unknown[] = [];
    const fakeWindow = { labcontrolUpdate: (d: unknown) => received.push(d) };
    const script = buildUpdateScript(data);

    // eslint-disable-next-line no-new-func
    new Function("window", script)(fakeWindow);

    expect(received).toEqual([data]);
    // O injectJavaScript do iOS exige que o script termine com um valor simples.
    expect(script.trim().endsWith("true;")).toBe(true);
  });

  it("não quebra se a página ainda não carregou o Leaflet", () => {
    // eslint-disable-next-line no-new-func
    const run = () => new Function("window", buildUpdateScript({ points: [], focus: null }))({});
    expect(run).not.toThrow();
  });
});

describe("página Leaflet", () => {
  const html = buildLeafletHtml();

  it("carrega o Leaflet fixado com integridade (SRI) e tiles do OpenStreetMap com atribuição", () => {
    expect(html).toContain(`src="${LEAFLET.js}" integrity="${LEAFLET.jsIntegrity}"`);
    expect(html).toContain(`href="${LEAFLET.css}" integrity="${LEAFLET.cssIntegrity}"`);
    expect(html).toContain(OSM_TILE_URL);
    expect(html).toContain("OpenStreetMap</a> contributors");
    expect(html).not.toMatch(/maps\.googleapis|key=/);
  });

  it("monta o popup com textContent, sem innerHTML", () => {
    expect(html).toContain("textContent");
    expect(html).not.toContain("innerHTML");
  });

  it("avisa o app quando carregou e quando falhou", () => {
    expect(html).toContain('send("ready")');
    expect(html).toContain('send("leaflet-error")');
  });
});
