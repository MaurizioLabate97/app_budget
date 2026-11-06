/**
 * Local-only data adapter for the existing UI.
 * Native builds use SQLite; browser preview uses localStorage for development.
 * Native builds use SQLite; browser preview uses localStorage for development.
 */
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'app_budget_local';
const STORE_KEY = 'app_budget_local_store_v1';
const TABLES = {
  Transaction: 'transactions',
  Category: 'categories',
  Budget: 'budgets',
  BankAccount: 'bank_accounts',
};
const DEFAULTS = {
  Transaction: { type: 'expense', pending: false, is_categorized: false, source: 'manual' },
  Category: { color: '#6366f1', icon: 'Tag', keywords: [] },
  Budget: {},
  BankAccount: {},
};

let sqliteDbPromise;
let memoryStorePromise;

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function getSqliteDb() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!sqliteDbPromise) {
    sqliteDbPromise = (async () => {
      const { SQLiteConnection, CapacitorSQLite } = await import('@capacitor-community/sqlite');
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      let db;
      try {
        db = await sqlite.retrieveConnection(DB_NAME, false);
      } catch {
        db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      }
      await db.open();
      await db.execute(`
        CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL, data_json TEXT NOT NULL, created_date TEXT NOT NULL, updated_date TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, data_json TEXT NOT NULL, created_date TEXT NOT NULL, updated_date TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY NOT NULL, data_json TEXT NOT NULL, created_date TEXT NOT NULL, updated_date TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS bank_accounts (id TEXT PRIMARY KEY NOT NULL, data_json TEXT NOT NULL, created_date TEXT NOT NULL, updated_date TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_transactions_created_date ON transactions(created_date);
        CREATE INDEX IF NOT EXISTS idx_categories_created_date ON categories(created_date);
      `);
      return db;
    })();
  }
  return sqliteDbPromise;
}

async function getBrowserStore() {
  if (!memoryStorePromise) {
    memoryStorePromise = Promise.resolve().then(() => {
      try {
        return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      } catch {
        return {};
      }
    });
  }
  return memoryStorePromise;
}

async function readAll(entityName) {
  const table = TABLES[entityName];
  const db = await getSqliteDb();
  if (db) {
    const result = await db.query(`SELECT data_json, created_date, updated_date FROM ${table}`);
    return (result.values || []).map((row) => ({ ...JSON.parse(row.data_json), created_date: row.created_date, updated_date: row.updated_date }));
  }
  const store = await getBrowserStore();
  return [...(store[table] || [])];
}

async function persist(entityName, items) {
  const table = TABLES[entityName];
  const db = await getSqliteDb();
  if (db) {
    await db.execute(`DELETE FROM ${table}`);
    for (const item of items) {
      await db.run(`INSERT INTO ${table} (id, data_json, created_date, updated_date) VALUES (?, ?, ?, ?)`, [
        item.id,
        JSON.stringify(item),
        item.created_date || new Date().toISOString(),
        item.updated_date || new Date().toISOString(),
      ]);
    }
    return;
  }
  const store = await getBrowserStore();
  store[table] = items;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function matches(item, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = item[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      return Object.entries(expected).every(([op, value]) => {
        if (op === '$gte') return actual >= value;
        if (op === '$gt') return actual > value;
        if (op === '$lte') return actual <= value;
        if (op === '$lt') return actual < value;
        if (op === '$ne') return actual !== value;
        if (op === '$in') return Array.isArray(value) && value.includes(actual);
        if (op === '$regex') {
          try {
            const flags = expected.$options?.includes('i') ? 'i' : '';
            return new RegExp(value, flags).test(String(actual ?? ''));
          } catch {
            return false;
          }
        }
        if (op === '$options') return true;
        return false;
      });
    }
    return actual === expected;
  });
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function buildEntity(entityName) {
  return {
    async filter(query = {}, options = {}) {
      let items = (await readAll(entityName)).filter((item) => matches(item, query));
      if (options.sort) {
        const desc = options.sort.startsWith('-');
        const field = desc ? options.sort.slice(1) : options.sort;
        items.sort((a, b) => compareValues(a[field], b[field]) * (desc ? -1 : 1));
      }
      const total = items.length;
      if (Number.isFinite(options.offset)) items = items.slice(options.offset);
      if (Number.isFinite(options.limit)) items = items.slice(0, options.limit);
      return { items, total };
    },
    async create(payload = {}) {
      const now = new Date().toISOString();
      const item = { ...DEFAULTS[entityName], ...payload, id: payload.id || uid(), created_date: now, updated_date: now };
      const items = await readAll(entityName);
      items.push(item);
      await persist(entityName, items);
      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entityName, action: 'create', item } }));
      window.dispatchEvent(new CustomEvent('expense-added')); 
      return item;
    },
    async update(id, payload = {}) {
      const items = await readAll(entityName);
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`${entityName} not found`);
      items[index] = { ...items[index], ...payload, id, updated_date: new Date().toISOString() };
      await persist(entityName, items);
      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entityName, action: 'update', item: items[index] } }));
      window.dispatchEvent(new CustomEvent('expense-added')); 
      return items[index];
    },
    async delete(id) {
      const items = await readAll(entityName);
      await persist(entityName, items.filter((item) => item.id !== id));
      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entityName, action: 'delete', id } }));
      window.dispatchEvent(new CustomEvent('expense-added')); 
      return { success: true };
    },
    async aggregate({ query = {}, groupBy, dateBucket, sum = [] } = {}) {
      const filtered = (await readAll(entityName)).filter((item) => matches(item, query));
      const groups = new Map();
      for (const item of filtered) {
        let key = 'all';
        let bucketDate;
        if (groupBy) key = String(item[groupBy] ?? '');
        if (dateBucket?.field && dateBucket?.unit === 'month') {
          bucketDate = String(item[dateBucket.field] || '').slice(0, 7);
          key = bucketDate;
        }
        if (!groups.has(key)) {
          const row = {};
          if (groupBy) row[groupBy] = item[groupBy];
          if (dateBucket) row[dateBucket.field] = `${key}-01`;
          for (const field of sum) row[`sum_${field}`] = 0;
          groups.set(key, row);
        }
        const row = groups.get(key);
        for (const field of sum) row[`sum_${field}`] += Number(item[field] || 0);
      }
      return { rows: [...groups.values()] };
    },
  };
}

export const localData = {
  entities: Object.fromEntries(Object.keys(TABLES).map((name) => [name, buildEntity(name)])),
  functions: {
    async invoke(name) {
      throw new Error(`La funzione online “${name}” non è disponibile: questa versione dell'app è progettata per funzionare localmente, senza servizi cloud.`);
    },
  },
};

export async function exportLocalData() {
  const output = { format: 'app-budget-local-backup', version: 1, exportedAt: new Date().toISOString(), data: {} };
  for (const entityName of Object.keys(TABLES)) output.data[entityName] = await readAll(entityName);
  return output;
}

export async function importLocalData(backup) {
  if (!backup || backup.format !== 'app-budget-local-backup' || !backup.data) throw new Error('File di backup non valido.');
  for (const entityName of Object.keys(TABLES)) await persist(entityName, Array.isArray(backup.data[entityName]) ? backup.data[entityName] : []);
  window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { action: 'import' } }));
}
