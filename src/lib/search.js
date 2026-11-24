const SEARCH_FIELDS = ["merchant_name", "description", "category_name"];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Query per la ricerca dei movimenti: esercente, descrizione o categoria, senza distinguere maiuscole. */
export function buildSearchQuery(text) {
  const term = String(text ?? "").trim();
  if (!term) return {};
  const pattern = escapeRegex(term);
  return { $or: SEARCH_FIELDS.map((field) => ({ [field]: { $regex: pattern, $options: "i" } })) };
}
