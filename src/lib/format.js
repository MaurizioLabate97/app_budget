const LOCALE = "it-IT";

export function formatCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    // In it-IT le cifre a 4 cifre non vengono raggruppate di default (1234,56 €).
    useGrouping: "always",
  }).format(amount || 0);
}

/** "2026-03-05" → "5/3/2026" (o "5/3" con withYear = false), senza passare da Date. */
export function formatDayMonth(dateStr, withYear = true) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export function monthLabel(ym) {
  const key = (ym || "").substring(0, 7);
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(LOCALE, { month: "short" });
}

/**
 * Converte un importo digitato dall'utente in numero.
 * Accetta la virgola o il punto come separatore decimale e il punto come
 * separatore delle migliaia: "12,50", "12.50", "1.234,56", "1234", "€ 5".
 * Restituisce NaN se il testo non è un importo valido. Arrotonda a 2 decimali.
 */
export function parseAmount(input) {
  let s = String(input ?? "").replace(/[\s€]/g, "");
  if (!s) return NaN;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    // Entrambi presenti: l'ultimo è il separatore decimale, l'altro le migliaia.
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    s = s.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Solo punti a gruppi di 3 cifre (es. "1.234"): migliaia all'italiana.
    s = s.split(".").join("");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;

  return Math.round(Number(s) * 100) / 100;
}

/** Numero -> testo per un campo importo in modifica (12.5 -> "12,5"). */
export function formatAmountInput(value) {
  return value == null || value === "" ? "" : String(value).replace(".", ",");
}

// Spostato in lib/date.js (calcolo su date locali, non UTC).
export { getMonthRange } from "./date";

export const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
