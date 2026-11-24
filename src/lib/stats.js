// Statistiche "dove spendo di più": funzioni pure, date come stringhe locali YYYY-MM-DD.

const FIXED_NAME = /mutuo|affitto|bollett|acqua|condomin|(^|\s)(luce|gas)(\s|$)/;
const NO_CATEGORY = { name: "Senza categoria", color: "#94a3b8", icon: "Tag" };
const TOP_COUNT = 5;

const pad = (n) => String(n).padStart(2, "0");
const parse = (s) => s.split("-").map(Number);
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
// Indice progressivo dei mesi (anno * 12 + mese 0-based): rende semplici somme e differenze.
const monthIndex = (s) => {
  const [y, m] = parse(s);
  return y * 12 + (m - 1);
};
const monthKey = (idx) => `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
const firstOfMonth = (idx) => `${monthKey(idx)}-01`;

function dayBefore(s) {
  const [y, m, d] = parse(s);
  const date = new Date(y, m - 1, d - 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Spesa fissa: vale il flag esplicito, altrimenti la regola sul nome. */
export function isFixedCategory(category) {
  if (!category) return false;
  if (typeof category.fixed === "boolean") return category.fixed;
  return FIXED_NAME.test(String(category.name || "").toLocaleLowerCase("it-IT"));
}

/** Periodo di `months` mesi che finisce col mese di `today`, più l'inizio del periodo precedente. */
export function periodRange(today, months) {
  const current = monthIndex(today);
  return {
    start: firstOfMonth(current - months + 1),
    end: firstOfMonth(current + 1),
    prevStart: firstOfMonth(current - 2 * months + 1),
  };
}

/** Giorno di inizio uso: la prima spesa in una categoria non fissa (o senza categoria). */
export function usageStart(transactions, categoriesById) {
  let first = null;
  for (const t of transactions) {
    if (t.type !== "expense" || !t.date) continue;
    if (isFixedCategory(categoriesById.get(t.category_id))) continue;
    if (first === null || t.date < first) first = t.date;
  }
  return first;
}

/**
 * Mesi effettivi in [from, to), tagliati da `start` a sinistra e da `today` (incluso) a destra.
 * I mesi tagliati valgono in proporzione ai giorni; con `clamp` un risultato tra 0 e 1 vale 1.
 */
export function effectiveMonths(from, to, start, today, { clamp = true } = {}) {
  if (!start) return 0;
  const lo = start > from ? start : from;
  const last = dayBefore(to);
  const hi = today < last ? today : last;
  if (lo > hi) return 0;

  const [loY, loM, loD] = parse(lo);
  const [hiY, hiM, hiD] = parse(hi);
  const loIdx = loY * 12 + (loM - 1);
  const hiIdx = hiY * 12 + (hiM - 1);
  let total = 0;
  for (let idx = loIdx; idx <= hiIdx; idx++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const dim = daysInMonth(y, m);
    const first = idx === loIdx ? loD : 1;
    const lastDay = idx === hiIdx ? hiD : dim;
    total += (lastDay - first + 1) / dim;
  }
  return clamp && total > 0 && total < 1 ? 1 : total;
}

const EMPTY = () => ({ avg: 0, prevAvg: null, fixedAvg: 0, fixedNames: [], rows: [] });

/** Classifica delle categorie di spesa non fisse nel periodo di `months` mesi che finisce oggi. */
export function computeStats({ transactions, categories, today, months }) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const expenses = transactions.filter((t) => t.type === "expense" && t.date);
  const { start, end, prevStart } = periodRange(today, months);
  const usage = usageStart(expenses, byId);
  const eff = effectiveMonths(start, end, usage, today);
  if (eff === 0) return EMPTY();
  // Un periodo precedente con meno di un mese di dati darebbe confronti assurdi: niente confronto.
  const prevRaw = effectiveMonths(prevStart, start, usage, today, { clamp: false });
  const prevEff = prevRaw >= 1 ? prevRaw : 0;

  const startIdx = monthIndex(start);
  const groups = new Map();
  let fixedTotal = 0;
  let prevVariable = 0;
  const fixedNames = new Set();

  for (const t of expenses) {
    const inCurrent = t.date >= start && t.date < end;
    const inPrev = t.date >= prevStart && t.date < start;
    if (!inCurrent && !inPrev) continue;

    const amount = Number(t.amount) || 0;
    const category = byId.get(t.category_id);
    if (isFixedCategory(category)) {
      // Prima dell'inizio uso le fisse non contano: il divisore parte da lì.
      if (inCurrent && t.date >= usage) {
        fixedTotal += amount;
        fixedNames.add(category.name);
      }
      continue;
    }

    const key = category ? category.id : null;
    if (!groups.has(key)) {
      groups.set(key, { category, total: 0, prevTotal: 0, monthly: new Array(months).fill(0), items: [] });
    }
    const g = groups.get(key);
    if (inCurrent) {
      g.total += amount;
      g.monthly[monthIndex(t.date) - startIdx] += amount;
      g.items.push(t);
    } else {
      g.prevTotal += amount;
      prevVariable += amount;
    }
  }

  const rows = [];
  for (const [key, g] of groups) {
    if (g.total <= 0) continue;
    const avg = g.total / eff;
    const prevRowAvg = prevEff > 0 ? g.prevTotal / prevEff : 0;
    const look = g.category || NO_CATEGORY;
    rows.push({
      categoryId: key,
      name: look.name || NO_CATEGORY.name,
      color: look.color || "#6366f1",
      icon: look.icon || "Tag",
      avg,
      share: 0,
      delta: prevRowAvg > 0 ? (avg - prevRowAvg) / prevRowAvg : null,
      monthly: g.monthly.map((total, i) => ({ key: monthKey(startIdx + i), total })),
      top: [...g.items].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, TOP_COUNT),
    });
  }
  rows.sort((a, b) => b.avg - a.avg);
  const avg = rows.reduce((s, r) => s + r.avg, 0);
  rows.forEach((r) => (r.share = avg > 0 ? r.avg / avg : 0));

  return {
    avg,
    prevAvg: prevEff > 0 ? prevVariable / prevEff : null,
    fixedAvg: fixedTotal / eff,
    fixedNames: [...fixedNames].sort((a, b) => a.localeCompare(b, "it-IT")),
    rows,
  };
}
