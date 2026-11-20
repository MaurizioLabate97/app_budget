/**
 * Logica dei budget mensili: riporto dal mese precedente e piccoli helper.
 * Funzioni pure, testate in budgets.test.js.
 */

export const BUDGET_STEP = 10;

const monthIndex = (year, month) => Number(year) * 12 + (Number(month) - 1);

/**
 * Voci da creare per il mese (year, month) copiando le voci ricorrenti
 * dell'ultimo mese precedente che ha budget. Vuoto se il mese ha già budget.
 */
export function budgetsToCarry(allBudgets, year, month) {
  const target = monthIndex(year, month);

  if (allBudgets.some((b) => monthIndex(b.year, b.month) === target)) return [];

  const earlier = allBudgets.filter((b) => monthIndex(b.year, b.month) < target);
  if (earlier.length === 0) return [];

  const source = Math.max(...earlier.map((b) => monthIndex(b.year, b.month)));
  const seen = new Set();

  return earlier
    .filter((b) => monthIndex(b.year, b.month) === source && b.recurring !== false)
    .filter((b) => (seen.has(b.category_id) ? false : seen.add(b.category_id)))
    .map((b) => ({
      category_id: b.category_id,
      category_name: b.category_name,
      amount_limit: b.amount_limit,
      recurring: true,
    }));
}

/** Categoria di spesa con quel nome (senza distinguere maiuscole e spazi). */
export function findCategoryByName(categories, name) {
  const key = name.trim().toLocaleLowerCase("it-IT");
  return categories.find(
    (c) => c.type === "expense" && (c.name || "").trim().toLocaleLowerCase("it-IT") === key
  );
}

/** Importo dopo un tocco su + (dir = 1) o − (dir = -1): passi di 10, minimo 10. */
export function nextStep(amount, dir) {
  const next =
    dir > 0
      ? Math.floor(amount / BUDGET_STEP) * BUDGET_STEP + BUDGET_STEP
      : Math.ceil(amount / BUDGET_STEP) * BUDGET_STEP - BUDGET_STEP;

  return Math.max(BUDGET_STEP, next);
}
