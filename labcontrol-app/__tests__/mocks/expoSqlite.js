// expo-sqlite para testes, com um SQLite real (sql.js, versão em JS puro).
//
// Cada escrita é copiada para `disk`, que representa o arquivo no aparelho.
// Abrir o banco de novo lê dessa cópia, como o app faz ao ser reaberto.
// `disk` sobrevive a jest.resetModules() porque fica em globalThis.
const disk = (globalThis.__SQLITE_DISK__ = globalThis.__SQLITE_DISK__ || new Map());

// O motor SQLite é carregado uma vez por processo de teste. Usamos o build em
// JS puro porque o build WebAssembly não carrega no ambiente do jest-expo.
function getSql() {
  if (!globalThis.__SQLJS__) {
    const initSqlJs = require("sql.js/dist/sql-asm.js");
    const originalWarn = console.warn;
    // Só o aviso de "asm.js deprecated" do sql.js é silenciado.
    console.warn = (...args) => {
      if (!String(args[0]).includes("asm.js build is deprecated")) originalWarn(...args);
    };
    globalThis.__SQLJS__ = initSqlJs().finally(() => {
      console.warn = originalWarn;
    });
  }
  return globalThis.__SQLJS__;
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  if (params.length === 1 && params[0] && typeof params[0] === "object") return params[0];
  return params;
}

function rowsOf(db, source, params) {
  const stmt = db.prepare(source);
  try {
    const bound = normalizeParams(params);
    if (Array.isArray(bound) ? bound.length > 0 : bound) stmt.bind(bound);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

class MockDatabase {
  constructor(name, db) {
    this.databaseName = name;
    this.db = db;
    this.closed = false;
    this.inTransaction = false;
  }

  assertOpen() {
    if (this.closed) throw new Error("Database is closed");
  }

  persist() {
    if (!this.inTransaction) disk.set(this.databaseName, this.db.export());
  }

  async execAsync(source) {
    this.assertOpen();
    this.db.exec(source);
    this.persist();
  }

  async runAsync(source, ...params) {
    this.assertOpen();
    rowsOf(this.db, source, params);
    const changes = this.db.getRowsModified();
    this.persist();
    return { changes, lastInsertRowId: 0 };
  }

  async getFirstAsync(source, ...params) {
    this.assertOpen();
    return rowsOf(this.db, source, params)[0] ?? null;
  }

  async getAllAsync(source, ...params) {
    this.assertOpen();
    return rowsOf(this.db, source, params);
  }

  async withTransactionAsync(task) {
    this.assertOpen();
    this.db.exec("BEGIN");
    this.inTransaction = true;
    try {
      await task();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.inTransaction = false;
      this.persist();
    }
  }

  async closeAsync() {
    this.persist();
    this.db.close();
    this.closed = true;
  }
}

module.exports = {
  __disk: disk,
  __resetDisk: () => disk.clear(),
  openDatabaseAsync: jest.fn(async (name) => {
    const SQL = await getSql();
    const bytes = disk.get(name);
    const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    return new MockDatabase(name, db);
  }),
};
