import { describe, it, expect, beforeEach, vi } from "vitest";

const STORE_KEY = "app_budget_local_store_v1";
const PREMIGRATION_KEY = "app_budget_local_store_premigration";

/** localStorage finto con una quota in caratteri, come Safari (circa 5 MB). */
function fakeStorage(quota) {
  const data = new Map();
  const used = () => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem(k, v) {
      const value = String(v);
      const next = used() - (data.get(k)?.length ?? 0) - (data.has(k) ? k.length : 0) + k.length + value.length;
      if (next > quota) {
        const error = new Error("The quota has been exceeded.");
        error.name = "QuotaExceededError";
        throw error;
      }
      data.set(k, value);
    },
    removeItem: (k) => data.delete(k),
  };
}

function v1Store(count) {
  return {
    transactions: Array.from({ length: count }, (_, i) => ({
      id: `t${i}`,
      type: "expense",
      amount: "1,50",
      date: "2026-11-01",
      merchant_name: "x".repeat(40),
      created_date: "c",
      updated_date: "u",
    })),
    categories: [],
    budgets: [],
  };
}

async function freshClient() {
  vi.resetModules();
  return import("./localDataClient");
}

let storage;

describe("store del browser", () => {
  beforeEach(() => {
    storage = fakeStorage(20000);
    vi.stubGlobal("localStorage", storage);
  });

  it("migra anche quando la copia di sicurezza non lascia spazio", async () => {
    // Importi già numerici: lo store migrato è appena più lungo (schema_version).
    const store = v1Store(80);
    store.transactions.forEach((t) => (t.amount = 1.5));
    const raw = JSON.stringify(store);
    // La copia ci sta, ma poi lo store migrato non entra più.
    storage = fakeStorage(STORE_KEY.length + PREMIGRATION_KEY.length + 2 * raw.length + 5);
    vi.stubGlobal("localStorage", storage);
    storage.setItem(STORE_KEY, raw);

    const { localData } = await freshClient();
    const { items } = await localData.entities.Transaction.filter({});

    expect(items).toHaveLength(80);
    expect(items[0].amount).toBe(1.5);
    expect(JSON.parse(storage.getItem(STORE_KEY)).schema_version).toBeGreaterThan(1);
  });

  it("la copia di sicurezza si toglie al primo avvio riuscito dopo la migrazione", async () => {
    storage.setItem(STORE_KEY, JSON.stringify(v1Store(3)));

    let client = await freshClient();
    await client.localData.entities.Transaction.filter({});
    expect(storage.getItem(PREMIGRATION_KEY)).not.toBeNull();

    client = await freshClient();
    await client.localData.entities.Transaction.filter({});
    expect(storage.getItem(PREMIGRATION_KEY)).toBeNull();
  });

  it("una scrittura senza spazio fallisce in italiano e non lascia righe fantasma", async () => {
    storage.setItem(STORE_KEY, JSON.stringify({ ...v1Store(0), schema_version: 3 }));
    const { localData } = await freshClient();

    await expect(
      localData.entities.Transaction.create({ description: "y".repeat(30000) })
    ).rejects.toThrow(/Spazio esaurito/);

    const { items } = await localData.entities.Transaction.filter({});
    expect(items).toHaveLength(0);
  });
});
