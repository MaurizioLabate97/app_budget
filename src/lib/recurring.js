/**
 * Logica delle spese ricorrenti: calcolo delle scadenze.
 *
 * Funzioni pure. Le date sono stringhe "YYYY-MM-DD" locali e `today` arriva
 * sempre dall'esterno (todayLocal()), così non dipendono dal fuso orario.
 *
 * Una scadenza è "gestita" se nel suo periodo (mese o anno) esiste già un
 * movimento con lo stesso recurring_id, oppure se il periodo è in
 * skipped_periods.
 */
import { toLocalDateString } from "./date";

const parse = (dateStr) => dateStr.split("-").map(Number);

const lastDayOfMonth = (year, month) => new Date(year, month, 0).getDate();

/** Chiave del periodo: "YYYY-MM" (mensile) o "YYYY" (annuale). */
export function periodKey(frequency, date) {
  return frequency === "yearly" ? date.slice(0, 4) : date.slice(0, 7);
}

/** Data della scadenza nel periodo indicato, con il giorno limitato a fine mese. */
export function occurrenceDate(recurring, key) {
  const [, startMonth, startDay] = parse(recurring.start_date);
  const year = Number(key.slice(0, 4));
  const month = recurring.frequency === "yearly" ? startMonth : Number(key.slice(5, 7));
  const day = Math.min(startDay, lastDayOfMonth(year, month));

  return toLocalDateString(new Date(year, month - 1, day));
}

/** Chiave del periodo successivo. */
function nextKey(frequency, key) {
  if (frequency === "yearly") return String(Number(key) + 1);

  const [year, month] = key.split("-").map(Number);
  return toLocalDateString(new Date(year, month, 1)).slice(0, 7);
}

/** Tutte le scadenze da start_date fino a `until` (incluso) ed end_date. */
function occurrencesUntil(recurring, until) {
  if (!recurring.start_date) return [];

  const limit = recurring.end_date && recurring.end_date < until ? recurring.end_date : until;
  const result = [];
  let key = periodKey(recurring.frequency, recurring.start_date);
  const lastKey = periodKey(recurring.frequency, limit);

  while (key <= lastKey) {
    const date = occurrenceDate(recurring, key);
    if (date >= recurring.start_date && date <= limit) {
      result.push({ date, periodKey: key });
    }
    key = nextKey(recurring.frequency, key);
  }

  return result;
}

function handledPeriods(recurring, transactions) {
  const handled = new Set(recurring.skipped_periods || []);

  for (const t of transactions) {
    if (t.recurring_id === recurring.id && t.occurrence_date) {
      handled.add(periodKey(recurring.frequency, t.occurrence_date));
    }
  }

  return handled;
}

function pendingFor(recurring, transactions, today) {
  const handled = handledPeriods(recurring, transactions);

  return occurrencesUntil(recurring, today)
    .filter((o) => !handled.has(o.periodKey))
    .map((o) => ({ recurring, ...o }));
}

/** Scadenze da confermare (ricorrenze attive, fino a oggi incluso), ordinate per data. */
export function getDueOccurrences(recurrings, transactions, today) {
  return recurrings
    .filter((r) => r.active !== false)
    .flatMap((r) => pendingFor(r, transactions, today))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Prima scadenza da oggi in poi (entro end_date) non ancora gestita, oppure null.
 * `transactions` serve a escludere i periodi già confermati.
 */
export function nextOccurrence(recurring, today, transactions = []) {
  if (!recurring.start_date) return null;

  const handled = handledPeriods(recurring, transactions);
  let key = periodKey(recurring.frequency, today > recurring.start_date ? today : recurring.start_date);

  // Limite di sicurezza: i periodi gestiti in avanti sono al massimo qualche saltato.
  for (let i = 0; i < 60; i++) {
    const date = occurrenceDate(recurring, key);
    if (recurring.end_date && date > recurring.end_date) return null;
    if (date >= today && date >= recurring.start_date && !handled.has(key)) return date;
    key = nextKey(recurring.frequency, key);
  }

  return null;
}

/**
 * Periodi arretrati non gestiti da saltare quando si riattiva una ricorrenza
 * sospesa (escluso il periodo di oggi, che resta da confermare).
 */
export function periodsToSkipOnResume(recurring, transactions, today) {
  const current = periodKey(recurring.frequency, today);

  return pendingFor(recurring, transactions, today)
    .map((o) => o.periodKey)
    .filter((key) => key !== current);
}

/**
 * Periodi da saltare quando si modifica la regola di una ricorrenza
 * (frequenza o data di inizio), così le scadenze passate della nuova regola
 * non ricompaiono tutte insieme.
 * - Frequenza cambiata: si saltano tutti i periodi passati non gestiti,
 *   tranne quello corrente.
 * - Stessa frequenza: si saltano solo i periodi prima del vecchio inizio;
 *   le scadenze arretrate già esistenti restano da confermare.
 */
export function periodsToSkipOnRuleChange(previous, next, transactions, today) {
  const sameFrequency = previous.frequency === next.frequency;
  const candidates = periodsToSkipOnResume(
    { ...next, skipped_periods: sameFrequency ? previous.skipped_periods || [] : [] },
    transactions,
    today
  );

  if (!sameFrequency) return candidates;

  const oldStartKey = periodKey(previous.frequency, previous.start_date);
  return candidates.filter((key) => key < oldStartKey);
}
