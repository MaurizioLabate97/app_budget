
/**
 * Local-only data adapter for the existing UI.
 * Native builds use SQLite; browser preview uses localStorage for development.
 *
 * SQLite writes are incremental for normal CRUD operations. Full-table replacement
 * is reserved for backup restoration and is protected by a SQLite transaction.
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

const ENTITY_NAMES = Object.keys(TABLES);

const DEFAULTS = {
  Transaction: {
    type: 'expense',
    pending: false,
    is_categorized: false,
    source: 'manual',
  },
  Category: {
    color: '#6366f1',
    icon: 'Tag',
    keywords: [],
  },
  Budget: {},
  BankAccount: {},
};

let sqliteDbPromise;
let memoryStorePromise;
let writeQueue = Promise.resolve();

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function serializeWrite(operation) {
  const result = writeQueue.then(operation, operation);

  // Keep the queue usable even when one operation fails.
  writeQueue = result.catch(() => undefined);

  return result;
}

function dispatchDataChanged(detail) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('local-data-changed', { detail })
  );

  window.dispatchEvent(new CustomEvent('expense-added'));
}

async function getSqliteDb() {
  if (!Capacitor.isNativePlatform()) return null;

  if (!sqliteDbPromise) {
    const initialization = (async () => {
      const {
        SQLiteConnection,
        CapacitorSQLite,
      } = await import('@capacitor-community/sqlite');

      const sqlite = new SQLiteConnection(CapacitorSQLite);
      let db;

      try {
        db = await sqlite.retrieveConnection(DB_NAME, false);
      } catch {
        // A missing connection is expected on first launch.
        // If creation also fails, surface the error.
        db = await sqlite.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }

      if (!(await db.isDBOpen()).result) {
        await db.open();
      }

      await db.execute(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY NOT NULL,
          data_json TEXT NOT NULL,
          created_date TEXT NOT NULL,
          updated_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          data_json TEXT NOT NULL,
          created_date TEXT NOT NULL,
          updated_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY NOT NULL,
          data_json TEXT NOT NULL,
          created_date TEXT NOT NULL,
          updated_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bank_accounts (
          id TEXT PRIMARY KEY NOT NULL,
          data_json TEXT NOT NULL,
          created_date TEXT NOT NULL,
          updated_date TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_created_date
        ON transactions(created_date);

        CREATE INDEX IF NOT EXISTS idx_categories_created_date
        ON categories(created_date);
      `);

      return db;
    })();

    sqliteDbPromise = initialization.catch((error) => {
      // Allow a later operation to retry initialization.
      sqliteDbPromise = undefined;
      throw error;
    });
  }

  return sqliteDbPromise;
}

async function getBrowserStore() {
  if (!memoryStorePromise) {
    memoryStorePromise = Promise.resolve().then(() => {
      try {
        return JSON.parse(
          localStorage.getItem(STORE_KEY) || '{}'
        );
      } catch {
        return {};
      }
    });
  }

  return memoryStorePromise;
}

function dateColumns(item) {
  const now = new Date().toISOString();

  return {
    created_date: item.created_date || now,
    updated_date: item.updated_date || now,
  };
}

async function readAll(entityName) {
  const table = TABLES[entityName];

  if (!table) {
    throw new Error(`Unknown entity: ${entityName}`);
  }

  const db = await getSqliteDb();

  if (db) {
    const result = await db.query(
      `SELECT data_json, created_date, updated_date FROM ${table}`
    );

    return (result.values || []).map((row) => ({
      ...JSON.parse(row.data_json),
      created_date: row.created_date,
      updated_date: row.updated_date,
    }));
  }

  const store = await getBrowserStore();

  return [...(store[table] || [])];
}

async function readOne(entityName, id) {
  const table = TABLES[entityName];
  const db = await getSqliteDb();

  if (db) {
    const result = await db.query(
      `SELECT data_json, created_date, updated_date
       FROM ${table}
       WHERE id = ?`,
      [id]
    );

    const row = result.values?.[0];

    if (!row) return null;

    return {
      ...JSON.parse(row.data_json),
      created_date: row.created_date,
      updated_date: row.updated_date,
    };
  }

  const store = await getBrowserStore();

  return (store[table] || []).find((item) => item.id === id) || null;
}

async function persistBrowser(entityName, items) {
  const table = TABLES[entityName];
  const store = await getBrowserStore();

  store[table] = items;

  localStorage.setItem(
    STORE_KEY,
    JSON.stringify(store)
  );
}

function matches(item, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = item[key];

    if (
      expected &&
      typeof expected === 'object' &&
      !Array.isArray(expected)
    ) {
      return Object.entries(expected).every(([op, value]) => {
        if (op === '$gte') return actual >= value;
        if (op === '$gt') return actual > value;
        if (op === '$lte') return actual <= value;
        if (op === '$lt') return actual < value;
        if (op === '$ne') return actual !== value;

        if (op === '$in') {
          return Array.isArray(value) && value.includes(actual);
        }

        if (op === '$regex') {
          try {
            const flags = expected.$options?.includes('i') ? 'i' : '';

            return new RegExp(value, flags).test(
              String(actual ?? '')
            );
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

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  return String(a).localeCompare(
    String(b),
    undefined,
    { numeric: true }
  );
}

function validateBackup(backup) {
  if (
    !backup ||
    backup.format !== 'app-budget-local-backup' ||
    !backup.data ||
    typeof backup.data !== 'object'
  ) {
    throw new Error('File di backup non valido.');
  }

  const normalized = {};

  for (const entityName of ENTITY_NAMES) {
    const rows = backup.data[entityName] ?? [];

    if (!Array.isArray(rows)) {
      throw new Error(
        `Backup non valido: i dati di ${entityName} non sono un elenco.`
      );
    }

    const ids = new Set();

    normalized[entityName] = rows.map((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        typeof item.id !== 'string' ||
        !item.id.trim()
      ) {
        throw new Error(
          `Backup non valido: è presente un record senza identificativo in ${entityName}.`
        );
      }

      if (ids.has(item.id)) {
        throw new Error(
          `Backup non valido: identificativo duplicato in ${entityName}.`
        );
      }

      ids.add(item.id);

      return {
        ...item,
        ...dateColumns(item),
      };
    });
  }

  return normalized;
}

async function replaceAllData(data) {
  if (!Capacitor.isNativePlatform()) {
    const store = getBrowserStore();

    for (const [entity, table] of Object.entries(TABLES)) {
      store[table] = data[table];
    }

    persistBrowser(store);
    return;
  }

  const db = await getSqliteDb();

  await db.beginTransaction();

  try {
    for (const table of Object.values(TABLES)) {
      await db.execute(
        `DELETE FROM ${table}`,
        false
      );

      for (const item of data[table]) {
        await db.run(
          `INSERT INTO ${table} (id, data_json, created_date, updated_date)
           VALUES (?, ?, ?, ?)`,
          [
            item.id,
            JSON.stringify(item),
            item.created_date,
            item.updated_date,
          ],
          false
        );
      }
    }

    await db.commitTransaction();
  } catch (error) {
    try {
      await db.rollbackTransaction();
    } catch (rollbackError) {
      console.error('Errore durante il rollback SQLite:', rollbackError);
    }

    throw error;
  }
}

function buildEntity(entityName) {
  const table = TABLES[entityName];

  return {
    async filter(query = {}, options = {}) {
      let items = (await readAll(entityName)).filter(
        (item) => matches(item, query)
      );

      if (options.sort) {
        const desc = options.sort.startsWith('-');
        const field = desc
          ? options.sort.slice(1)
          : options.sort;

        items.sort(
          (a, b) =>
            compareValues(a[field], b[field]) *
            (desc ? -1 : 1)
        );
      }

      const total = items.length;

      if (Number.isFinite(options.offset)) {
        items = items.slice(options.offset);
      }

      if (Number.isFinite(options.limit)) {
        items = items.slice(0, options.limit);
      }

      return { items, total };
    },

    async create(payload = {}) {
      return serializeWrite(async () => {
        const now = new Date().toISOString();

        const item = {
          ...DEFAULTS[entityName],
          ...payload,
          id: payload.id || uid(),
          created_date: now,
          updated_date: now,
        };

        const db = await getSqliteDb();

        if (db) {
          // SQLite: insert only the new record.
          await db.run(
            `INSERT INTO ${table}
             (id, data_json, created_date, updated_date)
             VALUES (?, ?, ?, ?)`,
            [
              item.id,
              JSON.stringify(item),
              item.created_date,
              item.updated_date,
            ]
          );
        } else {
          // Browser preview.
          const items = await readAll(entityName);

          items.push(item);

          await persistBrowser(entityName, items);
        }

        dispatchDataChanged({
          entityName,
          action: 'create',
          item,
        });

        return item;
      });
    },

    async update(id, payload = {}) {
      return serializeWrite(async () => {
        const db = await getSqliteDb();
        let updatedItem;

        if (db) {
          const current = await readOne(entityName, id);

          if (!current) {
            throw new Error(`${entityName} not found`);
          }

          updatedItem = {
            ...current,
            ...payload,
            id,
            updated_date: new Date().toISOString(),
          };

          const result = await db.run(
            `UPDATE ${table}
             SET data_json = ?, updated_date = ?
             WHERE id = ?`,
            [
              JSON.stringify(updatedItem),
              updatedItem.updated_date,
              id,
            ]
          );

          if (result.changes?.changes === 0) {
            throw new Error(`${entityName} not found`);
          }
        } else {
          const items = await readAll(entityName);

          const index = items.findIndex(
            (item) => item.id === id
          );

          if (index < 0) {
            throw new Error(`${entityName} not found`);
          }

          updatedItem = {
            ...items[index],
            ...payload,
            id,
            updated_date: new Date().toISOString(),
          };

          items[index] = updatedItem;

          await persistBrowser(entityName, items);
        }

        dispatchDataChanged({
          entityName,
          action: 'update',
          item: updatedItem,
        });

        return updatedItem;
      });
    },

    async delete(id) {
      return serializeWrite(async () => {
        const db = await getSqliteDb();

        if (db) {
          // SQLite: delete only the selected record.
          await db.run(
            `DELETE FROM ${table} WHERE id = ?`,
            [id]
          );
        } else {
          // Browser preview.
          const items = await readAll(entityName);

          await persistBrowser(
            entityName,
            items.filter((item) => item.id !== id)
          );
        }

        dispatchDataChanged({
          entityName,
          action: 'delete',
          id,
        });

        return { success: true };
      });
    },

    async aggregate({
      query = {},
      groupBy,
      dateBucket,
      sum = [],
    } = {}) {
      const filtered = (await readAll(entityName)).filter(
        (item) => matches(item, query)
      );

      const groups = new Map();

      for (const item of filtered) {
        let key = 'all';

        if (groupBy) {
          key = String(item[groupBy] ?? '');
        }

        if (
          dateBucket?.field &&
          dateBucket?.unit === 'month'
        ) {
          key = String(
            item[dateBucket.field] || ''
          ).slice(0, 7);
        }

        if (!groups.has(key)) {
          const row = {};

          if (groupBy) {
            row[groupBy] = item[groupBy];
          }

          if (dateBucket) {
            row[dateBucket.field] = `${key}-01`;
          }

          for (const field of sum) {
            row[`sum_${field}`] = 0;
          }

          groups.set(key, row);
        }

        const row = groups.get(key);

        for (const field of sum) {
          row[`sum_${field}`] += Number(item[field] || 0);
        }
      }

      return {
        rows: [...groups.values()],
      };
    },
  };
}

export const localData = {
  entities: Object.fromEntries(
    ENTITY_NAMES.map((name) => [
      name,
      buildEntity(name),
    ])
  ),

  functions: {
    async invoke(name) {
      throw new Error(
        `La funzione online “${name}” non è disponibile: ` +
        `questa versione dell'app è progettata per funzionare localmente, senza servizi cloud.`
      );
    },
  },
};

export async function exportLocalData() {
  const output = {
    format: 'app-budget-local-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {},
  };

  for (const entityName of ENTITY_NAMES) {
    output.data[entityName] = await readAll(entityName);
  }

  return output;
}

export async function importLocalData(backup) {
  const normalizedData = validateBackup(backup);

  await serializeWrite(
    () => replaceAllData(normalizedData)
  );

  dispatchDataChanged({
    action: 'import',
  });
}
