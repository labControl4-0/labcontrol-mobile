// MOB-03: consulta offline pelo cache SQLite e regras do formulário.
import { clearAuthSession, saveAuthSession } from "../lib/auth";
import { getCache, putCache } from "../lib/offline/cacheStore";
import {
  formatLocalDateTime,
  parseLocalDateTime,
  validateOccurrence,
  type OccurrenceFormValues,
} from "../lib/offline/occurrenceForm";
import { countUnsynced, createOccurrence, listOccurrences } from "../lib/offline/occurrenceRepository";
import { setUnauthorizedHandler } from "../services/api";
import { getMachinesByPlantCached, getPlantsCached } from "../services/catalogService";
import {
  API_URL,
  OTHER_TOKEN,
  OTHER_USER,
  TOKEN,
  USER,
  mockFetch,
  resetStorage,
  simulateAppKill,
  sqliteFileDump,
} from "./testUtils";

const PLANTS = [{ id: "p-1", name: "Lab Sintético A" }];
const MACHINES = [{ id: "m-1", plantId: "p-1", sectorId: "s-1", name: "Torno CNC 01", status: "active" }];

const backendDown = () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
};

beforeEach(async () => {
  await resetStorage();
  process.env.EXPO_PUBLIC_API_URL = API_URL;
  setUnauthorizedHandler(() => undefined);
  await saveAuthSession({ token: TOKEN, ...USER });
});

afterEach(() => jest.restoreAllMocks());

describe("consulta offline", () => {
  it("online grava no cache; sem rede devolve a cópia salva", async () => {
    mockFetch({ status: 200, body: PLANTS });
    expect(await getPlantsCached()).toEqual({ data: PLANTS, source: "network" });

    backendDown();
    const offline = await getPlantsCached();

    expect(offline.source).toBe("cache");
    expect(offline.data).toEqual(PLANTS);
    expect(offline.cachedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("o cache sobrevive a fechar e reabrir o app", async () => {
    mockFetch({ status: 200, body: MACHINES });
    await getMachinesByPlantCached("p-1");

    await simulateAppKill();
    backendDown();

    const catalog = require("../services/catalogService");
    const result = await catalog.getMachinesByPlantCached("p-1");
    expect(result).toMatchObject({ source: "cache", data: MACHINES });
  });

  it("sem rede e sem cache, mostra o erro de conexão", async () => {
    backendDown();
    await expect(getPlantsCached()).rejects.toMatchObject({ code: "network" });
  });

  it("401 não usa cache", async () => {
    mockFetch({ status: 200, body: PLANTS });
    await getPlantsCached();

    mockFetch({ status: 401 });
    await expect(getPlantsCached()).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("sem rede, o usuário consulta o cache e cria uma ocorrência pendente", async () => {
    mockFetch({ status: 200, body: MACHINES });
    await getMachinesByPlantCached("p-1");
    backendDown();

    const { data } = await getMachinesByPlantCached("p-1");
    const machine = data[0];
    await createOccurrence({
      userId: USER.id,
      machineId: machine.id,
      machineName: machine.name,
      sectorId: machine.sectorId,
      sectorName: null,
      eventType: "warning",
      description: "Ruído anormal no motor.",
      occurredAt: new Date().toISOString(),
    });

    const [saved] = await listOccurrences(USER.id);
    expect(saved).toMatchObject({ machineId: "m-1", sectorId: "s-1", syncStatus: "pending" });
  });

  it("só aceita dados permitidos no cache", async () => {
    await expect(putCache(USER.id, "users", [{ email: "x@example.test" }])).rejects.toThrow(
      /não permitido/
    );
  });

  it("cache vencido não é usado", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000);
    await putCache(USER.id, "plants", PLANTS, 60_000);

    now.mockReturnValue(61_000);
    expect(await getCache(USER.id, "plants")).toBeNull();
  });
});

describe("usuários e logout", () => {
  it("o login de outro usuário apaga o cache do anterior", async () => {
    mockFetch({ status: 200, body: PLANTS });
    await getPlantsCached();

    await saveAuthSession({ token: OTHER_TOKEN, ...OTHER_USER });
    backendDown();

    await expect(getPlantsCached()).rejects.toMatchObject({ code: "network" });
    expect(await getCache(USER.id, "plants")).toBeNull();
  });

  it("logout apaga o cache e as enviadas, mas mantém as pendentes do usuário", async () => {
    mockFetch({ status: 200, body: PLANTS });
    await getPlantsCached();
    await createOccurrence({
      userId: USER.id,
      machineId: "m-1",
      machineName: "Torno CNC 01",
      sectorId: "s-1",
      sectorName: null,
      eventType: "note",
      description: "Pendente antes do logout.",
      occurredAt: new Date().toISOString(),
    });

    await clearAuthSession();

    expect(await getCache(USER.id, "plants")).toBeNull();
    expect(await countUnsynced(USER.id)).toBe(1);
    expect(await listOccurrences(OTHER_USER.id)).toEqual([]);
  });

  it("o token nunca é gravado no arquivo SQLite", async () => {
    mockFetch({ status: 200, body: PLANTS });
    await getPlantsCached();
    await createOccurrence({
      userId: USER.id,
      machineId: "m-1",
      machineName: "Torno CNC 01",
      sectorId: "s-1",
      sectorName: null,
      eventType: "note",
      description: "Teste de vazamento de token.",
      occurredAt: new Date().toISOString(),
    });

    const dump = sqliteFileDump();
    expect(dump).toContain("Teste de vazamento de token.");
    expect(dump).not.toContain(TOKEN);
  });
});

describe("formulário", () => {
  const VALID: OccurrenceFormValues = {
    machineId: "m-1",
    machineName: "Torno CNC 01",
    sectorId: "s-1",
    sectorName: "Usinagem",
    eventType: "failure",
    description: "  Vazamento de óleo.  ",
    occurredAtText: "30/10/2026 10:05",
  };
  const NOW = new Date(2026, 9, 31, 12, 0);

  it("formata e lê a data no fuso do aparelho", () => {
    const date = new Date(2026, 9, 30, 10, 5);
    expect(formatLocalDateTime(date)).toBe("30/10/2026 10:05");
    expect(parseLocalDateTime("30/10/2026 10:05")?.getTime()).toBe(date.getTime());
  });

  it("rejeita datas inexistentes e formato errado", () => {
    expect(parseLocalDateTime("31/02/2026 10:00")).toBeNull();
    expect(parseLocalDateTime("2026-10-30 10:05")).toBeNull();
    expect(parseLocalDateTime("30/10/2026 24:00")).toBeNull();
  });

  it("valida, apara a descrição e converte a data para ISO", () => {
    const result = validateOccurrence(VALID, NOW);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.description).toBe("Vazamento de óleo.");
      expect(result.value.occurredAt).toBe(new Date(2026, 9, 30, 10, 5).toISOString());
    }
  });

  it("aponta cada campo inválido", () => {
    const result = validateOccurrence(
      { ...VALID, machineId: "", sectorId: "", eventType: "x", description: "abc", occurredAtText: "01/12/2026 10:00" },
      NOW
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["description", "eventType", "machineId", "occurredAtText", "sectorId"].sort()
      );
      expect(result.errors.occurredAtText).toMatch(/futuro/);
    }
  });
});
