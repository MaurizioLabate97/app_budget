import { describe, it, expect } from "vitest";
import { matches } from "./query";
import { buildSearchQuery } from "./search";

const tx = {
  merchant_name: "Esselunga",
  description: "Spesa settimanale",
  category_name: "Ristoranti",
  type: "expense",
};

describe("matches", () => {
  it("$or vero se almeno una condizione è vera", () => {
    expect(matches(tx, { $or: [{ type: "income" }, { merchant_name: "Esselunga" }] })).toBe(true);
    expect(matches(tx, { $or: [{ type: "income" }, { merchant_name: "Lidl" }] })).toBe(false);
  });
  it("$or si combina con gli altri filtri", () => {
    expect(matches(tx, { type: "income", $or: [{ merchant_name: "Esselunga" }] })).toBe(false);
  });
  it("gli operatori esistenti funzionano come prima", () => {
    expect(matches({ date: "2026-11-10" }, { date: { $gte: "2026-11-01", $lt: "2026-12-01" } })).toBe(true);
    expect(matches(tx, { description: { $regex: "spesa", $options: "i" } })).toBe(true);
  });
});

describe("buildSearchQuery", () => {
  const find = (text, item = tx) => matches(item, buildSearchQuery(text));

  it("testo vuoto: nessun filtro", () => {
    expect(buildSearchQuery("  ")).toEqual({});
  });
  it("trova esercente, descrizione e categoria senza distinguere maiuscole", () => {
    expect(find("esselunga")).toBe(true);
    expect(find("SETTIMANALE")).toBe(true);
    expect(find("ristor")).toBe(true);
    expect(find("lidl")).toBe(false);
  });
  it("i caratteri speciali valgono come testo", () => {
    const item = { description: "Spesa (casa) + extra" };
    expect(find("(casa)", item)).toBe(true);
    expect(find("+ extra", item)).toBe(true);
    expect(find("a.a", { description: "aXa" })).toBe(false);
  });
  it("campi mancanti non rompono la ricerca", () => {
    expect(find("esse", { merchant_name: "Esselunga" })).toBe(true);
  });
});
