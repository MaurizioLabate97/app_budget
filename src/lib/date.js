/**
 * Helper per le date "di calendario" (YYYY-MM-DD) nel fuso orario locale.
 *
 * Non usare toISOString() per ricavare un giorno: converte in UTC e in Italia
 * (UTC+1/+2) la mezzanotte locale diventa il giorno precedente.
 */

const pad = (n) => String(n).padStart(2, "0");

/** Date -> "YYYY-MM-DD" secondo il fuso orario locale. */
export function toLocalDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Data di oggi come "YYYY-MM-DD" locale. */
export function todayLocal() {
  return toLocalDateString(new Date());
}

/**
 * Intervallo di un mese come date locali, da usare con $gte/$lt.
 * @param {number} year  es. 2026
 * @param {number} month 1-12
 * @returns {{ start: string, end: string }} start incluso, end escluso (1° del mese successivo)
 */
export function getMonthRange(year, month) {
  return {
    start: toLocalDateString(new Date(year, month - 1, 1)),
    end: toLocalDateString(new Date(year, month, 1)),
  };
}
