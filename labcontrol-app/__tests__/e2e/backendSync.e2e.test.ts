/**
 * @jest-environment node
 */
// MOB-04: teste ponta a ponta contra a API real (processo e banco de verdade).
//
// O teste liga, derruba e religa o processo da API, e verifica no banco (via
// GET da API) que cada ocorrência foi gravada exatamente uma vez.
// Fica desligado em `npm test`. Como rodar: docs/MATRIZ_CENARIOS_OFFLINE.md.
//
// Variáveis:
//   E2E_API_DLL            caminho do LabControlApi.dll compilado
//   E2E_DB_CONNECTION      connection string de um Postgres DESCARTÁVEL
//   E2E_API_PORT           porta da API (padrão 5080)
//   E2E_PROXY_PORT         porta do proxy de falhas (padrão 5081)
import { spawn, type ChildProcess } from "child_process";
import http from "http";
import path from "path";

import { resetStorage, simulateAppKill } from "../testUtils";

const DLL = process.env.E2E_API_DLL;
const DB = process.env.E2E_DB_CONNECTION;
const API_PORT = Number(process.env.E2E_API_PORT ?? 5080);
const PROXY_PORT = Number(process.env.E2E_PROXY_PORT ?? 5081);
const API_BASE = `http://127.0.0.1:${API_PORT}/api`;
const APP_BASE = `http://127.0.0.1:${PROXY_PORT}/api`;

const describeE2E = DLL && DB ? describe : describe.skip;

// fetch do Node: a API real é chamada de verdade.
const realFetch: typeof fetch = globalThis.fetch;

// ─── Processo da API ──────────────────────────────────────────────────────────

let apiProcess: ChildProcess | null = null;
const apiLog: string[] = [];

async function isApiUp() {
  try {
    const res = await realFetch(`${API_BASE}/plants`);
    return res.status === 401; // rota protegida respondendo = API no ar
  } catch {
    return false;
  }
}

async function startApi() {
  apiProcess = spawn("dotnet", [DLL!], {
    cwd: path.dirname(DLL!),
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://127.0.0.1:${API_PORT}`,
      ASPNETCORE_ENVIRONMENT: "Development",
      ConnectionStrings__DefaultConnection: DB!,
      Mqtt__Host: "127.0.0.1",
      Mqtt__Port: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiProcess.stdout?.on("data", (d) => apiLog.push(String(d)));
  apiProcess.stderr?.on("data", (d) => apiLog.push(String(d)));

  const deadline = Date.now() + 90_000;
  while (!(await isApiUp())) {
    if (Date.now() > deadline) throw new Error(`API não subiu.\n${apiLog.slice(-20).join("")}`);
    if (apiProcess.exitCode !== null) throw new Error(`API encerrou.\n${apiLog.slice(-20).join("")}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function stopApi() {
  const proc = apiProcess;
  apiProcess = null;
  if (!proc || proc.exitCode !== null) return;
  const exited = new Promise((r) => proc.once("exit", r));
  proc.kill();
  await exited;
  expect(await isApiUp()).toBe(false);
}

// ─── Proxy de falhas entre o app e a API ──────────────────────────────────────
// "pass": repassa. "delayResponse": repassa, a API grava, mas a resposta só
// volta depois do timeout do app (resposta perdida). API fora do ar: o proxy
// derruba a conexão, como uma falha de rede.

let proxyMode: "pass" | "delayResponse" = "pass";
let proxy: http.Server;
const proxiedPosts: string[] = [];

function startProxy() {
  proxy = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (req.method === "POST") proxiedPosts.push(req.url ?? "");
      const upstream = http.request(
        { host: "127.0.0.1", port: API_PORT, path: req.url, method: req.method, headers: req.headers },
        (up) => {
          const body: Buffer[] = [];
          up.on("data", (c) => body.push(c));
          up.on("end", () => {
            const reply = () => {
              if (res.destroyed) return;
              res.writeHead(up.statusCode ?? 502, up.headers);
              res.end(Buffer.concat(body));
            };
            if (proxyMode === "delayResponse" && req.method === "POST") setTimeout(reply, 3000);
            else reply();
          });
        }
      );
      upstream.on("error", () => req.socket.destroy());
      upstream.end(Buffer.concat(chunks));
    });
  });
  return new Promise<void>((r) => proxy.listen(PROXY_PORT, "127.0.0.1", () => r()));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const unique = `${Date.now()}`;
let token = "";
let userId = "";
let machineId = "";
let sectorId = "";

async function direct(pathname: string, init: RequestInit = {}) {
  const res = await realFetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${pathname} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Eventos gravados na API para a máquina de teste, contados pelo UUID do app. */
async function serverEventsByRef() {
  const events: Array<{ id: string; message: string }> = await direct(
    `/machine-events/machine/${machineId}`
  );
  const counts: Record<string, number> = {};
  for (const e of events) {
    const ref = /Ref\. app: (\S+)$/.exec(e.message)?.[1] ?? "sem-ref";
    counts[ref] = (counts[ref] ?? 0) + 1;
  }
  return { events, counts };
}

function newOccurrence(description: string) {
  const repo = require("../../lib/offline/occurrenceRepository");
  return repo.createOccurrence({
    userId,
    machineId,
    machineName: "Torno E2E",
    sectorId,
    sectorName: "Setor E2E",
    eventType: "failure",
    description,
    occurredAt: new Date().toISOString(),
  });
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describeE2E("E2E com a API real", () => {
  jest.setTimeout(240_000);

  beforeAll(async () => {
    await resetStorage();
    globalThis.fetch = realFetch;
    process.env.EXPO_PUBLIC_API_URL = APP_BASE;
    delete process.env.EXPO_PUBLIC_API_TIMEOUT_MS;

    await startProxy();
    await startApi();

    // Usuário e dados sintéticos, criados direto na API.
    const email = `e2e-${unique}@example.test`;
    await direct("/Auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Usuária E2E", email, password: "senha-e2e-123" }),
    });

    const { login } = require("../../services/authService");
    const session = await login({ email, password: "senha-e2e-123" });
    token = session.token;
    userId = session.user.id;

    const plant = await direct("/plants", {
      method: "POST",
      body: JSON.stringify({
        name: `Lab E2E ${unique}`,
        description: "Dados sintéticos",
        scale: 1,
        widthUnits: 100,
        heightUnits: 100,
      }),
    });
    const sector = await direct("/sectors", {
      method: "POST",
      body: JSON.stringify({
        plantId: plant.id,
        name: "Setor E2E",
        type: "production",
        color: "#3366FF",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        areaM2: 50,
      }),
    });
    const machine = await direct("/machines", {
      method: "POST",
      body: JSON.stringify({
        plantId: plant.id,
        sectorId: sector.id,
        name: "Torno E2E",
        model: "Sintético",
        posX: 5,
        posY: 5,
        status: "active",
      }),
    });
    sectorId = sector.id;
    machineId = machine.id;
  });

  afterAll(async () => {
    await stopApi().catch(() => undefined);
    await new Promise((r) => proxy?.close(() => r(null)));
  });

  it("backend parado: pendências sobrevivem ao app e ao backend reiniciados e são gravadas uma vez", async () => {
    await stopApi();

    const a = await newOccurrence(`E2E A ${unique}`);
    const b = await newOccurrence(`E2E B ${unique}`);
    const c = await newOccurrence(`E2E C ${unique}`);

    let sync = require("../../services/occurrenceSync");
    const offline = await sync.syncPendingOccurrences({ trigger: "manual" });
    expect(offline).toMatchObject({ sent: 0, stoppedBy: "network" });

    // O app é fechado com as pendências e o backend volta.
    await simulateAppKill();
    globalThis.fetch = realFetch;
    await startApi();

    sync = require("../../services/occurrenceSync");
    const repo = require("../../lib/offline/occurrenceRepository");
    expect(await repo.countUnsynced(userId)).toBe(3);

    const online = await sync.syncPendingOccurrences({ trigger: "reconnect" });
    expect(online).toMatchObject({ remaining: 0, stoppedBy: null });
    expect(online.sent + online.recovered).toBe(3);

    for (const o of [a, b, c]) {
      const local = await repo.getOccurrence(userId, o.id);
      expect(local).toMatchObject({ syncStatus: "synced" });
      expect(local.serverId).toMatch(/^[0-9a-f-]{36}$/);
    }

    // Persistido de verdade: continua lá depois de reiniciar o backend de novo.
    await stopApi();
    await startApi();
    const { counts } = await serverEventsByRef();
    expect(counts[a.id]).toBe(1);
    expect(counts[b.id]).toBe(1);
    expect(counts[c.id]).toBe(1);
  });

  it("timeout depois de gravar: repetir não duplica o evento no servidor", async () => {
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = "1000";
    const sync = require("../../services/occurrenceSync");
    const repo = require("../../lib/offline/occurrenceRepository");
    const created = await newOccurrence(`E2E timeout ${unique}`);

    proxyMode = "delayResponse";
    const postsBefore = proxiedPosts.length;
    const first = await sync.syncPendingOccurrences({ trigger: "manual" });
    expect(first.stoppedBy).toBe("timeout");
    expect(await repo.getOccurrence(userId, created.id)).toMatchObject({
      syncStatus: "pending",
      needsCheck: true,
    });

    // A API gravou mesmo sem o app receber a resposta.
    await new Promise((r) => setTimeout(r, 3500));
    expect((await serverEventsByRef()).counts[created.id]).toBe(1);

    proxyMode = "pass";
    const second = await sync.syncPendingOccurrences({ trigger: "manual" });
    expect(second).toMatchObject({ sent: 0, recovered: 1 });
    expect(proxiedPosts.length - postsBefore).toBe(1);

    expect((await serverEventsByRef()).counts[created.id]).toBe(1);
    expect(await repo.getOccurrence(userId, created.id)).toMatchObject({ syncStatus: "synced" });
    delete process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
  });
});
