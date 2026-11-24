import { describe, it, expect } from "vitest";
import { isFixedCategory, periodRange, usageStart, effectiveMonths, computeStats } from "./stats";

describe("isFixedCategory", () => {
  it("riconosce le fisse dal nome", () => {
    expect(isFixedCategory({ name: "Mutuo" })).toBe(true);
    expect(isFixedCategory({ name: "Bollette luce" })).toBe(true);
    expect(isFixedCategory({ name: "Gas" })).toBe(true);
    expect(isFixedCategory({ name: "Gasolio" })).toBe(false);
    expect(isFixedCategory({ name: "Ristoranti" })).toBe(false);
    expect(isFixedCategory(null)).toBe(false);
  });
  it("il flag esplicito vince sul nome", () => {
    expect(isFixedCategory({ name: "Mutuo", fixed: false })).toBe(false);
    expect(isFixedCategory({ name: "Ristoranti", fixed: true })).toBe(true);
  });
});

describe("periodRange", () => {
  it("3 mesi a novembre", () => {
    expect(periodRange("2026-11-24", 3)).toEqual({ start: "2026-09-01", end: "2026-12-01", prevStart: "2026-06-01" });
  });
  it("a cavallo d'anno", () => {
    expect(periodRange("2026-01-10", 3)).toEqual({ start: "2025-11-01", end: "2026-02-01", prevStart: "2025-08-01" });
  });
});

describe("effectiveMonths", () => {
  const T = "2026-11-24";
  it("mesi pieni più il mese corrente in proporzione", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", "2026-01-05", T)).toBeCloseTo(2.8);
  });
  it("il mese di inizio conta dal giorno della prima spesa", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", "2026-10-20", T)).toBeCloseTo(12 / 31 + 24 / 30);
  });
  it("meno di un mese vale 1", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", "2026-11-20", T)).toBe(1);
  });
  it("0 senza inizio o senza sovrapposizione", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", null, T)).toBe(0);
    expect(effectiveMonths("2026-06-01", "2026-09-01", "2026-10-20", T)).toBe(0);
  });
  it("periodo precedente pieno", () => {
    expect(effectiveMonths("2026-06-01", "2026-09-01", "2026-01-05", T)).toBe(3);
  });
});

describe("usageStart", () => {
  it("ignora entrate e categorie fisse, conta le spese senza categoria", () => {
    const cats = new Map([["m", { id: "m", name: "Mutuo" }], ["s", { id: "s", name: "Spesa" }]]);
    const txs = [
      { type: "expense", category_id: "m", date: "2026-01-01", amount: 650 },
      { type: "income", date: "2026-02-01", amount: 2000 },
      { type: "expense", category_id: "s", date: "2026-06-01", amount: 100 },
      { type: "expense", date: "2026-05-15", amount: 10 },
    ];
    expect(usageStart(txs, cats)).toBe("2026-05-15");
    expect(usageStart([], cats)).toBe(null);
  });
});

describe("computeStats", () => {
  const categories = [
    { id: "s", name: "Spesa", color: "#16a34a", icon: "ShoppingBag" },
    { id: "m", name: "Mutuo" },
    { id: "r", name: "Ristoranti", color: "#ea580c", icon: "Utensils" },
  ];
  const e = (category_id, date, amount) => ({ id: `${category_id}-${date}-${amount}`, type: "expense", category_id, date, amount });
  const transactions = [
    e("m", "2026-01-01", 650),
    e("s", "2026-06-01", 100), e("s", "2026-07-10", 200), e("s", "2026-08-10", 300),
    e("s", "2026-09-05", 280), e("s", "2026-10-05", 280), e("s", "2026-11-05", 280),
    e("r", "2026-11-12", 140),
    e("m", "2026-09-01", 650), e("m", "2026-10-01", 650), e("m", "2026-11-01", 650),
    { id: "inc", type: "income", date: "2026-11-01", amount: 2000 },
    { id: "nocat", type: "expense", date: "2026-11-10", amount: 35 },
    e("deleted", "2026-11-11", 7),
  ];
  const res = computeStats({ transactions, categories, today: "2026-11-24", months: 3 });

  it("classifica, medie e quote", () => {
    expect(res.rows.map((r) => r.name)).toEqual(["Spesa", "Ristoranti", "Senza categoria"]);
    expect(res.rows[0].avg).toBeCloseTo(300);
    expect(res.rows[1].avg).toBeCloseTo(50);
    expect(res.rows[2]).toMatchObject({ categoryId: null, color: "#94a3b8" });
    expect(res.rows[2].avg).toBeCloseTo(42 / 2.8);
    expect(res.avg).toBeCloseTo(300 + 50 + 15);
    expect(res.rows[0].share).toBeCloseTo(300 / 365);
  });
  it("confronto col periodo precedente", () => {
    expect(res.prevAvg).toBeCloseTo(200);
    expect(res.rows[0].delta).toBeCloseTo(0.5);
    expect(res.rows[1].delta).toBe(null);
  });
  it("spese fisse escluse", () => {
    expect(res.fixedAvg).toBeCloseTo(1950 / 2.8);
    expect(res.fixedNames).toEqual(["Mutuo"]);
  });
  it("mese per mese con i buchi a zero, e le spese più grosse", () => {
    expect(res.rows[1].monthly).toEqual([
      { key: "2026-09", total: 0 }, { key: "2026-10", total: 0 }, { key: "2026-11", total: 140 },
    ]);
    expect(res.rows[0].top.map((t) => t.amount)).toEqual([280, 280, 280]);
  });
  it("le spese fisse prima dell'inizio uso non gonfiano la media", () => {
    const res2 = computeStats({
      transactions: [e("m", "2026-09-01", 650), e("m", "2026-10-01", 650), e("m", "2026-11-01", 650), e("s", "2026-11-10", 50)],
      categories,
      today: "2026-11-24",
      months: 3,
    });
    expect(res2.fixedAvg).toBe(0);
    expect(res2.fixedNames).toEqual([]);
  });
  it("nessun confronto se il periodo precedente copre meno di un mese", () => {
    const res2 = computeStats({
      transactions: [e("s", "2026-08-28", 40), e("s", "2026-10-05", 300), e("r", "2026-11-05", 100)],
      categories,
      today: "2026-11-24",
      months: 3,
    });
    expect(res2.prevAvg).toBe(null);
    expect(res2.rows.every((r) => r.delta === null)).toBe(true);
  });
  it("senza movimenti", () => {
    expect(computeStats({ transactions: [], categories, today: "2026-11-24", months: 3 }))
      .toEqual({ avg: 0, prevAvg: null, fixedAvg: 0, fixedNames: [], rows: [] });
  });
});
