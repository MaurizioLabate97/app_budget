
/**
 * Local-only data adapter for the existing UI.
 * Native builds use SQLite; browser preview uses localStorage for development.
 *
 * SQLite writes are incremental for normal CRUD operations. Full-table replacement
 * is reserved for backup restoration and is protected by a SQLite transaction.
 */
import { Capacitor } from '@capacitor/core';
import { matches } from '@/lib/query';
import {
  SCHEMA_VERSION,
  migrateData,
  pendingMigrations,
  readVersion,
  INDEXES_VERSION,
} from '@/lib/migrations';
import { buildSqlWhere, indexedColumns, INDEXED_COLUMNS } from '@/lib/sqlWhere';

const DB_NAME = 'app_budget_local';
const STORE_KEY = 'app_budget_local_store_v1';
// Copia dello store prima dell'ultima migrazione (solo browser), per sicurezza.
const PREMIGRATION_KEY = 'app_budget_local_store_premigration';

const TABLES = {
  Transaction: 'transactions',
  Category: 'categories',
  Budget: 'budgets',
  BankAccount: 'bank_accounts',
  RecurringTransaction: 'recurring_transactions',
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
  RecurringTransaction: {
    frequency: 'monthly',
    active: true,
    skipped_periods: [],
  },
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

const dataListeners = new Set();

/**
 * Avvisa `listener` dopo ogni scrittura con `{ entityName | entityNames, action }`
 * (`{ action: 'import' }` dopo un restore). Restituisce la funzione per disiscriversi.
 */
export function subscribeDataChanged(listener) {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

function dispatchDataChanged(detail) {
  for (const listener of dataListeners) {
    try {
      listener(detail);
    } catch (error) {
      console.error('Errore in un listener dei dati:', error);
    }
  }
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

        CREATE TABLE IF NOT EXISTS recurring_transactions (
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

      await migrateSqlite(db);

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

function parseRow(row) {
  return {
    ...JSON.parse(row.data_json),
    created_date: row.created_date,
    updated_date: row.updated_date,
  };
}

const INDEXED_TABLE = 'transactions';

/**
 * Colonne da scrivere per un record oltre a id e date: `data_json` e, per le
 * transazioni, le colonne indicizzate (che vanno tenute allineate a data_json).
 */
function rowValues(table, item, withIndexes = true) {
  const columns = ['data_json'];
  const values = [JSON.stringify(item)];

  if (table === INDEXED_TABLE && withIndexes) {
    columns.push(...INDEXED_COLUMNS);
    values.push(...indexedColumns(item));
  }

  return { columns, values };
}

/** `UPDATE ... SET` per un record: "data_json = ?, date = ?, ..." più i valori. */
function rowSet(table, item, withIndexes = true) {
  const { columns, values } = rowValues(table, item, withIndexes);

  return {
    set: columns.map((column) => `${column} = ?`).join(', '),
    values,
  };
}

async function insertRow(db, table, item, transaction = true) {
  const { columns, values } = rowValues(table, item);
  const all = ['id', ...columns, 'created_date', 'updated_date'];

  await db.run(
    `INSERT INTO ${table} (${all.join(', ')})
     VALUES (${all.map(() => '?').join(', ')})`,
    [item.id, ...values, item.created_date, item.updated_date],
    transaction
  );
}

/**
 * Porta il database SQLite alla versione corrente, una migrazione alla volta,
 * tutto in un'unica transazione. La versione sta in `PRAGMA user_version`
 * (0 = database creato prima del versioning, cioè versione 1).
 * Usa `db` direttamente: qui getSqliteDb() non ha ancora finito.
 * Esportata solo per i test.
 */
export async function migrateSqlite(db) {
  const res = await db.query('PRAGMA user_version');
  let version = readVersion(res.values?.[0]?.user_version);
  const pending = pendingMigrations(version);

  if (!pending.length) return;

  await db.beginTransaction();

  try {
    for (const migration of pending) {
      for (const statement of migration.sql ?? []) {
        await db.execute(statement, false);
      }

      if (migration.up) {
        const data = {};

        for (const [entityName, table] of Object.entries(TABLES)) {
          const rows = await db.query(
            `SELECT data_json, created_date, updated_date FROM ${table}`
          );
          data[entityName] = (rows.values || []).map(parseRow);
        }

        const result = migrateData(data, version, migration.version);

        for (const [entityName, table] of Object.entries(TABLES)) {
          for (const item of result.data[entityName]) {
            if (!result.changedIds[entityName].has(item.id)) continue;

            // Niente updated_date: è un aggiornamento dei dati, non una modifica dell'utente.
            const { set, values } = rowSet(table, item, version >= INDEXES_VERSION);
            await db.run(
              `UPDATE ${table} SET ${set} WHERE id = ?`,
              [...values, item.id],
              false
            );
          }
        }
      }

      if (migration.backfillIndexes) {
        const rows = await db.query(`SELECT id, data_json FROM ${INDEXED_TABLE}`);

        for (const row of rows.values || []) {
          await db.run(
            `UPDATE ${INDEXED_TABLE}
             SET ${INDEXED_COLUMNS.map((column) => `${column} = ?`).join(', ')}
             WHERE id = ?`,
            [...indexedColumns(JSON.parse(row.data_json)), row.id],
            false
          );
        }
      }

      version = migration.version;
    }

    await db.execute(`PRAGMA user_version = ${version}`, false);
    await db.commitTransaction();
  } catch (error) {
    try {
      await db.rollbackTransaction();
    } catch (rollbackError) {
      console.error('Errore durante il rollback SQLite:', rollbackError);
    }

    throw new Error(`Aggiornamento dei dati non riuscito: ${error.message}`);
  }
}

/**
 * Legge lo store del browser e, se serve, lo porta alla versione corrente
 * con una sola scrittura. Prima salva una copia dei dati vecchi, se c'è spazio.
 */
function loadBrowserStore() {
  let raw;

  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    raw = null;
  }

  if (!raw) return { schema_version: SCHEMA_VERSION };

  let store;

  try {
    store = JSON.parse(raw);
  } catch {
    return { schema_version: SCHEMA_VERSION };
  }

  const version = readVersion(store.schema_version);
  const data = Object.fromEntries(
    Object.entries(TABLES).map(([entityName, table]) => [entityName, store[table] || []])
  );
  const result = migrateData(data, version);

  if (!result.changed) return store;

  const migrated = { ...store, schema_version: result.version };

  for (const [entityName, table] of Object.entries(TABLES)) {
    migrated[table] = result.data[entityName];
  }

  try {
    localStorage.setItem(PREMIGRATION_KEY, raw);
  } catch {
    // Spazio esaurito: si migra lo stesso, la scrittura sotto resta unica.
  }

  localStorage.setItem(STORE_KEY, JSON.stringify(migrated));

  return migrated;
}

async function getBrowserStore() {
  if (!memoryStorePromise) {
    memoryStorePromise = Promise.resolve()
      .then(loadBrowserStore)
      .catch((error) => {
        // Un errore (es. dati di una versione più recente) si ripresenta al prossimo accesso.
        memoryStorePromise = undefined;
        throw error;
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

/**
 * Legge tutti i record di un'entità. Con `query`, su SQLite le transazioni
 * vengono pre-filtrate sulle colonne indicizzate: chi chiama applica comunque
 * l'intera query con `matches()`.
 */
async function readAll(entityName, query) {
  const table = TABLES[entityName];

  if (!table) {
    throw new Error(`Unknown entity: ${entityName}`);
  }

  const db = await getSqliteDb();

  if (db) {
    const { where, params } =
      query && table === INDEXED_TABLE ? buildSqlWhere(query) : { where: '', params: [] };

    const result = await db.query(
      `SELECT data_json, created_date, updated_date FROM ${table} ${where}`,
      params
    );

    return (result.values || []).map(parseRow);
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

    return parseRow(row);
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

/**
 * Sostituisce tutti i dati locali con quelli di un backup già validato.
 * `data` è indicizzato per nome entità (Transaction, Category, ...),
 * come restituito da validateBackup().
 */
async function replaceAllData(data) {
  if (!Capacitor.isNativePlatform()) {
    const store = await getBrowserStore();

    for (const [entityName, table] of Object.entries(TABLES)) {
      store[table] = data[entityName] ?? [];
    }

    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return;
  }

  const db = await getSqliteDb();

  await db.beginTransaction();

  try {
    for (const [entityName, table] of Object.entries(TABLES)) {
      await db.execute(
        `DELETE FROM ${table}`,
        false
      );

      for (const item of data[entityName] ?? []) {
        await insertRow(db, table, item, false);
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
      let items = (await readAll(entityName, query)).filter(
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
          ...structuredClone(DEFAULTS[entityName]),
          ...payload,
          id: payload.id || uid(),
          created_date: now,
          updated_date: now,
        };

        const db = await getSqliteDb();

        if (db) {
          // SQLite: insert only the new record.
          await insertRow(db, table, item);
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

          const { set, values } = rowSet(table, updatedItem);
          const result = await db.run(
            `UPDATE ${table}
             SET ${set}, updated_date = ?
             WHERE id = ?`,
            [...values, updatedItem.updated_date, id]
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
      const filtered = (await readAll(entityName, query)).filter(
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

/**
 * Quante transazioni, budget e spese ricorrenti usano una categoria.
 * Serve a mostrare l'impatto prima dell'eliminazione.
 */
export async function getCategoryUsage(categoryId) {
  const [transactions, budgets, recurrings] = await Promise.all([
    readAll('Transaction'),
    readAll('Budget'),
    readAll('RecurringTransaction'),
  ]);

  return {
    transactions: transactions.filter((t) => t.category_id === categoryId).length,
    budgets: budgets.filter((b) => b.category_id === categoryId).length,
    recurrings: recurrings.filter((r) => r.category_id === categoryId).length,
  };
}

function withoutCategory(item, now) {
  const { category_id: _categoryId, category_name: _categoryName, ...rest } = item;

  return { ...rest, updated_date: now };
}

function uncategorize(transaction, now) {
  const { category_id: _categoryId, category_name: _categoryName, ...rest } = transaction;

  return { ...rest, is_categorized: false, updated_date: now };
}

/**
 * Elimina una categoria in modo consistente:
 * - le transazioni collegate restano, ma diventano "senza categoria";
 * - i budget collegati vengono eliminati;
 * - le spese ricorrenti collegate restano, ma senza categoria.
 * Su SQLite avviene tutto in un'unica transazione.
 */
export async function deleteCategoryCascade(categoryId) {
  const result = await serializeWrite(async () => {
    const now = new Date().toISOString();
    const affectedTransactions = (await readAll('Transaction', { category_id: categoryId })).filter(
      (t) => t.category_id === categoryId
    );
    const affectedBudgets = (await readAll('Budget')).filter(
      (b) => b.category_id === categoryId
    );
    const affectedRecurrings = (await readAll('RecurringTransaction')).filter(
      (r) => r.category_id === categoryId
    );

    const db = await getSqliteDb();

    if (db) {
      await db.beginTransaction();

      try {
        for (const transaction of affectedTransactions) {
          const updated = uncategorize(transaction, now);
          const { set, values } = rowSet('transactions', updated);

          await db.run(
            `UPDATE transactions SET ${set}, updated_date = ? WHERE id = ?`,
            [...values, now, transaction.id],
            false
          );
        }

        for (const budget of affectedBudgets) {
          await db.run(`DELETE FROM budgets WHERE id = ?`, [budget.id], false);
        }

        for (const recurring of affectedRecurrings) {
          const updated = withoutCategory(recurring, now);

          await db.run(
            `UPDATE recurring_transactions SET data_json = ?, updated_date = ? WHERE id = ?`,
            [JSON.stringify(updated), now, recurring.id],
            false
          );
        }

        await db.run(`DELETE FROM categories WHERE id = ?`, [categoryId], false);

        await db.commitTransaction();
      } catch (error) {
        try {
          await db.rollbackTransaction();
        } catch (rollbackError) {
          console.error('Errore durante il rollback SQLite:', rollbackError);
        }

        throw error;
      }
    } else {
      const store = await getBrowserStore();

      store.transactions = (store.transactions || []).map((t) =>
        t.category_id === categoryId ? uncategorize(t, now) : t
      );
      store.budgets = (store.budgets || []).filter(
        (b) => b.category_id !== categoryId
      );
      store.recurring_transactions = (store.recurring_transactions || []).map((r) =>
        r.category_id === categoryId ? withoutCategory(r, now) : r
      );
      store.categories = (store.categories || []).filter(
        (c) => c.id !== categoryId
      );

      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    }

    return {
      transactions: affectedTransactions.length,
      budgets: affectedBudgets.length,
      recurrings: affectedRecurrings.length,
    };
  });

  dispatchDataChanged({
    entityNames: ['Category', 'Transaction', 'Budget', 'RecurringTransaction'],
    action: 'delete',
    id: categoryId,
  });

  return result;
}

export async function exportLocalData() {
  const output = {
    format: 'app-budget-local-backup',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {},
  };

  for (const entityName of ENTITY_NAMES) {
    output.data[entityName] = await readAll(entityName);
  }

  return output;
}

export async function importLocalData(backup) {
  // Un backup vecchio si porta alla versione corrente prima di sostituire i dati.
  const version = readVersion(backup?.version);
  const normalizedData = migrateData(validateBackup(backup), version).data;

  await serializeWrite(
    () => replaceAllData(normalizedData)
  );

  dispatchDataChanged({
    action: 'import',
  });
}
