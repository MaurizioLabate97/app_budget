/**
 * Operazioni sui budget che scrivono dati (usano il data layer).
 * La logica pura sta in budgets.js.
 */
import { localData } from "@/api/localDataClient";
import { budgetsToCarry, findCategoryByName } from "./budgets";
import { MONTH_NAMES } from "./format";

const NEW_CATEGORY_COLORS = ["#6366f1", "#06b6d4", "#f97316", "#22c55e", "#ec4899", "#8b5cf6", "#eab308"];

// Icona proposta per i nomi più comuni (nomi delle icone in categoryicon.jsx).
const ICON_BY_NAME = [
  [/mutuo|affitto|casa/, "Home"],
  [/spesa|supermercato/, "ShoppingBag"],
  [/alcol|birr|aperitiv|(^|\s)bar(\s|$)/, "Beer"],
  [/regal/, "Gift"],
  [/trasport|bus|treno|metro/, "Bus"],
  [/benzina|carburante/, "Fuel"],
  [/auto|macchina/, "Car"],
  [/ristorant|cena|pranzo|cibo/, "Utensils"],
  [/caff/, "Coffee"],
  [/palestra|sport/, "Dumbbell"],
  [/bollett|(^|\s)(luce|gas)(\s|$)/, "Zap"],
  [/telefon|abbonament/, "Smartphone"],
  [/viagg|vacanz/, "Plane"],
  [/vestit|abbigliament/, "Shirt"],
  [/salute|medic|farmac/, "Heart"],
  [/gioch|videogioch/, "Gamepad2"],
  [/libr/, "BookOpen"],
  [/animal|cane|gatto/, "PawPrint"],
];

function iconFor(name) {
  const key = name.toLocaleLowerCase("it-IT");
  return ICON_BY_NAME.find(([re]) => re.test(key))?.[1] || "Tag";
}

// Un solo riporto alla volta per mese: evita doppioni se la pagina carica due volte.
const carryInFlight = new Map();

// Mesi già preparati: se l'utente poi ne elimina tutte le voci, non vanno ricopiate.
const INITIALIZED_KEY = "app_budget_budget_months_v1";

function readInitialized() {
  try {
    return new Set(JSON.parse(localStorage.getItem(INITIALIZED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function markInitialized(key) {
  try {
    const set = readInitialized();
    if (set.has(key)) return;
    set.add(key);
    localStorage.setItem(INITIALIZED_KEY, JSON.stringify([...set]));
  } catch {
    // Senza storage il riporto resta comunque corretto, solo meno "ricordato".
  }
}

/** Da chiamare dopo un restore: i mesi del backup vanno ricontrollati da zero. */
export function resetBudgetMonthMarkers() {
  try {
    localStorage.removeItem(INITIALIZED_KEY);
  } catch {
    // Nessuno storage: niente da azzerare.
  }
}

/** Riempie un mese vuoto con le voci ricorrenti dell'ultimo mese con budget. */
export function ensureMonthBudgets(year, month) {
  const key = `${year}-${month}`;
  if (carryInFlight.has(key)) return carryInFlight.get(key);
  if (readInitialized().has(key)) return Promise.resolve(0);

  const run = (async () => {
    const { items } = await localData.entities.Budget.filter({});
    const toCreate = budgetsToCarry(items, year, month);
    for (const data of toCreate) {
      await localData.entities.Budget.create({ ...data, month, year });
    }
    // Il mese conta come preparato se ora ha voci (copiate o già presenti).
    if (toCreate.length > 0 || items.some((b) => b.year === year && b.month === month)) {
      markInitialized(key);
    }
    return toCreate.length;
  })().finally(() => carryInFlight.delete(key));

  carryInFlight.set(key, run);
  return run;
}

/** Restituisce la categoria di spesa con quel nome, creandola se non esiste. */
async function getOrCreateCategory(name) {
  const { items } = await localData.entities.Category.filter({});
  const existing = findCategoryByName(items, name);
  if (existing) return existing;

  const expenseCount = items.filter((c) => c.type === "expense").length;
  return localData.entities.Category.create({
    name: name.trim(),
    type: "expense",
    icon: iconFor(name),
    color: NEW_CATEGORY_COLORS[expenseCount % NEW_CATEGORY_COLORS.length],
  });
}

/**
 * Crea una voce di budget (e la categoria se serve) per il mese indicato.
 * Lancia un errore leggibile se quella categoria ha già un budget nel mese.
 */
export async function createBudgetEntry({ name, amount, recurring, year, month, skipIfExists = false }) {
  const category = await getOrCreateCategory(name);

  const { items: sameMonth } = await localData.entities.Budget.filter({
    category_id: category.id,
    month,
    year,
  });
  if (sameMonth.length > 0) {
    if (skipIfExists) return sameMonth[0];
    throw new Error(`Hai già un budget per ${category.name} a ${MONTH_NAMES[month - 1].toLowerCase()}.`);
  }

  return localData.entities.Budget.create({
    category_id: category.id,
    category_name: category.name,
    month,
    year,
    amount_limit: amount,
    recurring,
  });
}
