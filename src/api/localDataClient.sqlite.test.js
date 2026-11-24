import { describe, it, expect, beforeAll } from "vitest";
import initSqlJs from "sql.js";
import { migrateSqlite } from "./localDataClient";
import { SCHEMA_VERSION } from "@/lib/migrations";

// Adattatore minimo con la stessa interfaccia di @capacitor-community/sqlite.
function wrap(raw) {
  const rows = (sql, params = []) => {
    const stmt = raw.prepare(sql);
    stmt.bind(params);
    const out = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    stmt.free();
    return out;
  };
  return {
    async query(sql, params) {
      return { values: rows(sql, params) };
    },
    async execute(sql) {
      raw.exec(sql);
      return { changes: { changes: raw.getRowsModified() } };
    },
    async run(sql, params) {
      raw.run(sql, params);
      return { changes: { changes: raw.getRowsModified() } };
    },
    async beginTransaction() {
      raw.exec("BEGIN");
    },
    async commitTransaction() {
      raw.exec("COMMIT");
    },
    async rollbackTransaction() {
      raw.exec("ROLLBACK");
    },
    raw: rows,
  };
}

// Schema creato dalle versioni senza versioning (user_version = 0).
const V1_SCHEMA = ["transactions", "categories", "budgets", "bank_accounts", "recurring_transactions"]
  .map(
    (t) =>
      `CREATE TABLE ${t} (id TEXT PRIMARY KEY NOT NULL, data_json TEXT NOT NULL, created_date TEXT NOT NULL, updated_date TEXT NOT NULL);`
  )
  .join("\n");

let SQL;
beforeAll(async () => {
  SQL = await initSqlJs();
});

function v1Database() {
  const raw = new SQL.Database();
  raw.exec(V1_SCHEMA);
  const insert = (table, item) =>
    raw.run(`INSERT INTO ${table} VALUES (?, ?, 'c', 'u')`, [item.id, JSON.stringify(item)]);
  insert("transactions", { id: "t1", amount: "12,50", date: "2026-11-02", type: "expense", category_id: "c1" });
  insert("transactions", { id: "t2", amount: 5, date: "2026-10-30", type: "income" });
  insert("categories", { id: "c1", name: "Stipendio", type: "income", fixed: true });
  insert("budgets", { id: "b1", amount_limit: "200" });
  return wrap(raw);
}

describe("migrateSqlite", () => {
  it("porta un database senza versione all'ultima versione", async () => {
    const db = v1Database();
    await migrateSqlite(db);

    expect(db.raw("PRAGMA user_version")[0].user_version).toBe(SCHEMA_VERSION);

    const tx = db.raw("SELECT id, data_json, date, type, category_id, updated_date FROM transactions ORDER BY id");
    expect(JSON.parse(tx[0].data_json).amount).toBe(12.5);
    expect(tx[0]).toMatchObject({ date: "2026-11-02", type: "expense", category_id: "c1", updated_date: "u" });
    expect(tx[1]).toMatchObject({ date: "2026-10-30", type: "income", category_id: null });

    expect(JSON.parse(db.raw("SELECT data_json FROM budgets")[0].data_json).amount_limit).toBe(200);
    expect("fixed" in JSON.parse(db.raw("SELECT data_json FROM categories")[0].data_json)).toBe(false);

    const indexes = db.raw("SELECT name FROM sqlite_master WHERE type = 'index'").map((r) => r.name);
    expect(indexes).toEqual(
      expect.arrayContaining(["idx_transactions_date", "idx_transactions_type_date", "idx_transactions_category"])
    );
  });

  it("una seconda apertura non rifà nulla", async () => {
    const db = v1Database();
    await migrateSqlite(db);
    await expect(migrateSqlite(db)).resolves.toBeUndefined();
    expect(db.raw("PRAGMA user_version")[0].user_version).toBe(SCHEMA_VERSION);
  });

  it("se una migrazione fallisce non cambia niente", async () => {
    const db = v1Database();
    // La colonna esiste già: l'ALTER TABLE della v3 fallisce.
    await db.execute("ALTER TABLE transactions ADD COLUMN date TEXT");
    await expect(migrateSqlite(db)).rejects.toThrow(/Aggiornamento dei dati non riuscito/);
    expect(db.raw("PRAGMA user_version")[0].user_version).toBe(0);
    expect(JSON.parse(db.raw("SELECT data_json FROM transactions WHERE id = 't1'")[0].data_json).amount).toBe("12,50");
  });

  it("rifiuta un database di una versione più recente", async () => {
    const db = v1Database();
    await db.execute(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await expect(migrateSqlite(db)).rejects.toThrow(/versione più recente/);
  });
});
