import { parseAmount } from "@/lib/format";

/**
 * Versioni dello schema dei dati locali.
 *
 * Ogni migrazione ha:
 * - `version`: la versione a cui porta i dati;
 * - `sql` (facoltativo): istruzioni di struttura, eseguite solo su SQLite;
 * - `up` (facoltativo): trasforma un record, `(entityName, item) => item`.
 *   Restituire lo stesso oggetto significa "nessun cambio".
 *
 * Le migrazioni girano una volta sola, in ordine, all'apertura dei dati e
 * sui backup importati. Le aggiunte vanno sempre in coda.
 */
export const ENTITY_NAMES = [
  "Transaction",
  "Category",
  "Budget",
  "BankAccount",
  "RecurringTransaction",
];

const AMOUNT_FIELDS = {
  Transaction: "amount",
  RecurringTransaction: "amount",
  Budget: "amount_limit",
};

export const MIGRATIONS = [
  {
    // Importi salvati come testo dalle prime versioni ("12,50") e flag "spesa fissa"
    // rimasto su categorie di entrata.
    version: 2,
    up(entityName, item) {
      const field = AMOUNT_FIELDS[entityName];
      if (field && typeof item[field] === "string") {
        const value = parseAmount(item[field]);
        if (Number.isFinite(value)) return { ...item, [field]: value };
      }
      if (entityName === "Category" && item.type === "income" && "fixed" in item) {
        const { fixed: _fixed, ...rest } = item;
        return rest;
      }
      return item;
    },
  },
];

export const SCHEMA_VERSION = MIGRATIONS.at(-1).version;

/** I dati senza versione (o con 0, il default di SQLite) sono della versione 1. */
export function readVersion(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function assertSupportedVersion(version) {
  if (version > SCHEMA_VERSION) {
    throw new Error(
      "I dati sono stati salvati da una versione più recente dell'app: aggiorna l'app prima di usarli."
    );
  }
}

/** Migrazioni da applicare per passare da `fromVersion` a `toVersion`. */
export function pendingMigrations(fromVersion, toVersion = SCHEMA_VERSION) {
  assertSupportedVersion(fromVersion);
  return MIGRATIONS.filter((m) => m.version > fromVersion && m.version <= toVersion);
}

/**
 * Porta i dati (indicizzati per entità) alla versione corrente, o a `toVersion`.
 * Non modifica l'input. `changedIds` dice quali record vanno riscritti.
 */
export function migrateData(data, fromVersion, toVersion = SCHEMA_VERSION) {
  const pending = pendingMigrations(fromVersion, toVersion);
  const out = {};
  const changedIds = {};

  for (const entityName of ENTITY_NAMES) {
    const ids = new Set();
    out[entityName] = (data?.[entityName] ?? []).map((original) => {
      let item = original;
      for (const migration of pending) {
        if (migration.up) item = migration.up(entityName, item);
      }
      if (item !== original) ids.add(original.id);
      return item;
    });
    changedIds[entityName] = ids;
  }

  return {
    data: out,
    version: pending.length ? pending.at(-1).version : fromVersion,
    changed: pending.length > 0,
    changedIds,
  };
}
