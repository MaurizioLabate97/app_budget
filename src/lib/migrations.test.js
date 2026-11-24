import { describe, it, expect } from "vitest";
import { SCHEMA_VERSION, MIGRATIONS, migrateData, readVersion } from "./migrations";

const empty = () => ({
  Transaction: [],
  Category: [],
  Budget: [],
  BankAccount: [],
  RecurringTransaction: [],
});

describe("readVersion", () => {
  it("tratta come versione 1 i dati senza versione", () => {
    expect(readVersion(undefined)).toBe(1);
    expect(readVersion(null)).toBe(1);
    expect(readVersion(0)).toBe(1);
  });

  it("restituisce la versione salvata", () => {
    expect(readVersion(2)).toBe(2);
  });
});

describe("migrateData", () => {
  it("le migrazioni sono in ordine e arrivano a SCHEMA_VERSION", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(versions.at(-1)).toBe(SCHEMA_VERSION);
  });

  it("dati già aggiornati: nessun cambio", () => {
    const data = { ...empty(), Transaction: [{ id: "a", amount: "12,50" }] };
    const res = migrateData(data, SCHEMA_VERSION);
    expect(res.version).toBe(SCHEMA_VERSION);
    expect(res.changed).toBe(false);
    expect(res.data.Transaction[0].amount).toBe("12,50");
  });

  it("v2: converte in numeri gli importi salvati come testo", () => {
    const data = {
      ...empty(),
      Transaction: [
        { id: "a", amount: "12,50" },
        { id: "b", amount: 7 },
        { id: "c", amount: "1.234,56" },
      ],
      RecurringTransaction: [{ id: "r", amount: "650" }],
      Budget: [{ id: "x", amount_limit: "200,5" }],
    };
    const res = migrateData(data, 1);
    expect(res.data.Transaction.map((t) => t.amount)).toEqual([12.5, 7, 1234.56]);
    expect(res.data.RecurringTransaction[0].amount).toBe(650);
    expect(res.data.Budget[0].amount_limit).toBe(200.5);
    expect(res.version).toBe(SCHEMA_VERSION);
    expect(res.changed).toBe(true);
  });

  it("v2: lascia com'è un importo non interpretabile", () => {
    const data = { ...empty(), Transaction: [{ id: "a", amount: "boh" }, { id: "b" }] };
    const res = migrateData(data, 1);
    expect(res.data.Transaction[0].amount).toBe("boh");
    expect("amount" in res.data.Transaction[1]).toBe(false);
  });

  it("v2: toglie il flag fixed dalle categorie di entrata", () => {
    const data = {
      ...empty(),
      Category: [
        { id: "s", type: "income", fixed: true },
        { id: "m", type: "expense", fixed: true },
      ],
    };
    const res = migrateData(data, 1);
    expect("fixed" in res.data.Category[0]).toBe(false);
    expect(res.data.Category[1].fixed).toBe(true);
  });

  it("non modifica i dati di partenza", () => {
    const data = { ...empty(), Transaction: [{ id: "a", amount: "3,5" }] };
    migrateData(data, 1);
    expect(data.Transaction[0].amount).toBe("3,5");
  });

  it("riporta gli id dei record cambiati per entità", () => {
    const data = {
      ...empty(),
      Transaction: [{ id: "a", amount: "3,5" }, { id: "b", amount: 4 }],
    };
    const res = migrateData(data, 1);
    expect([...res.changedIds.Transaction]).toEqual(["a"]);
  });

  it("entità mancanti diventano elenchi vuoti", () => {
    const res = migrateData({ Transaction: [{ id: "a", amount: 1 }] }, 1);
    expect(res.data.Category).toEqual([]);
  });

  it("con toVersion si ferma a quella versione", () => {
    const data = { ...empty(), Transaction: [{ id: "a", amount: "3,5" }] };
    const res = migrateData(data, 1, 1);
    expect(res.changed).toBe(false);
    expect(res.version).toBe(1);
    expect(res.data.Transaction[0].amount).toBe("3,5");
    expect(migrateData(data, 1, 2).data.Transaction[0].amount).toBe(3.5);
  });

  it("rifiuta dati di una versione più recente dell'app", () => {
    expect(() => migrateData(empty(), SCHEMA_VERSION + 1)).toThrow(/versione più recente/);
  });
});
