export function formatCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount || 0);
}

export function monthLabel(ym) {
  const key = (ym || "").substring(0, 7);
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short" });
}

export function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];