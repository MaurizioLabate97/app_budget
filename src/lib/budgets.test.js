import { describe, test, expect } from "vitest";
import { budgetsToCarry, findCategoryByName, nextStep } from "./budgets";

const b = (id, cat, year, month, amount, extra = {}) => ({
  id,
  category_id: cat,
  category_name: cat.toUpperCase(),
  year,
  month,
  amount_limit: amount,
  ...extra,
});

describe("budgetsToCarry", () => {
  test("copia le voci ricorrenti del mese precedente con gli importi ritoccati", () => {
    const all = [b("1", "spesa", 2026, 11, 350), b("2", "mutuo", 2026, 11, 700)];
    expect(budgetsToCarry(all, 2026, 12)).toEqual([
      { category_id: "spesa", category_name: "SPESA", amount_limit: 350, recurring: true },
      { category_id: "mutuo", category_name: "MUTUO", amount_limit: 700, recurring: true },
    ]);
  });

  test("le voci solo questo mese non vengono riportate", () => {
    const all = [b("1", "spesa", 2026, 12, 350), b("2", "regali", 2026, 12, 100, { recurring: false })];
    expect(budgetsToCarry(all, 2027, 1).map((x) => x.category_id)).toEqual(["spesa"]);
  });

  test("nessuna copia se il mese ha già budget", () => {
    const all = [b("1", "spesa", 2026, 11, 350), b("2", "alcol", 2026, 12, 50)];
    expect(budgetsToCarry(all, 2026, 12)).toEqual([]);
  });

  test("prende l'ultimo mese con budget anche se c'è un buco e attraversa l'anno", () => {
    const all = [b("1", "spesa", 2026, 10, 300), b("2", "spesa", 2026, 11, 320)];
    expect(budgetsToCarry(all, 2027, 2)[0].amount_limit).toBe(320);
  });

  test("ignora i mesi successivi a quello richiesto", () => {
    const all = [b("1", "spesa", 2026, 12, 999)];
    expect(budgetsToCarry(all, 2026, 11)).toEqual([]);
  });

  test("niente budget prima: niente da copiare", () => {
    expect(budgetsToCarry([], 2026, 11)).toEqual([]);
  });

  test("doppioni nel mese sorgente: una sola voce per categoria", () => {
    const all = [b("1", "spesa", 2026, 11, 350), b("2", "spesa", 2026, 11, 400)];
    expect(budgetsToCarry(all, 2026, 12)).toHaveLength(1);
  });
});

describe("findCategoryByName", () => {
  const cats = [
    { id: "a", name: "Spesa", type: "expense" },
    { id: "b", name: "Stipendio", type: "income" },
  ];
  test("trova la categoria di spesa ignorando maiuscole e spazi", () => {
    expect(findCategoryByName(cats, "  spesa ")?.id).toBe("a");
  });
  test("non usa categorie di entrata", () => {
    expect(findCategoryByName(cats, "stipendio")).toBeUndefined();
  });
});

describe("nextStep", () => {
  test("passi di 10 e minimo 10", () => {
    expect(nextStep(350, 1)).toBe(360);
    expect(nextStep(350, -1)).toBe(340);
    expect(nextStep(10, -1)).toBe(10);
    expect(nextStep(15, -1)).toBe(10);
  });
  test("importi non multipli di 10 si allineano alla decina", () => {
    expect(nextStep(355, 1)).toBe(360);
    expect(nextStep(355, -1)).toBe(350);
  });
});
