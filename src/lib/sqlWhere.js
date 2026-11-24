/**
 * Pre-filtro SQL per le transazioni sulla build nativa.
 *
 * Usa solo le colonne indicizzate (`date`, `type`, `category_id`) e solo le
 * condizioni di primo livello che si traducono senza ambiguità. Il risultato è
 * sempre un sovrainsieme di ciò che `matches()` accetta: il data layer applica
 * comunque l'intera query in JS sulle righe restituite.
 */
export const INDEXED_COLUMNS = ["date", "type", "category_id"];

const RANGE_OPS = { $gte: ">=", $gt: ">", $lte: "<=", $lt: "<" };

const isText = (value) => typeof value === "string";

export function buildSqlWhere(query) {
  const conditions = [];
  const params = [];

  const date = query?.date;
  if (isText(date)) {
    conditions.push("date = ?");
    params.push(date);
  } else if (date && typeof date === "object" && !Array.isArray(date)) {
    for (const [op, sqlOp] of Object.entries(RANGE_OPS)) {
      if (isText(date[op])) {
        conditions.push(`date ${sqlOp} ?`);
        params.push(date[op]);
      }
    }
  }

  if (isText(query?.type)) {
    conditions.push("type = ?");
    params.push(query.type);
  }

  const category = query?.category_id;
  if (isText(category)) {
    conditions.push("category_id = ?");
    params.push(category);
  } else if (Array.isArray(category?.$in) && category.$in.every(isText)) {
    if (category.$in.length === 0) {
      conditions.push("1 = 0");
    } else {
      conditions.push(`category_id IN (${category.$in.map(() => "?").join(", ")})`);
      params.push(...category.$in);
    }
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

/** Valori delle colonne indicizzate di una transazione, nell'ordine di INDEXED_COLUMNS. */
export function indexedColumns(item) {
  return INDEXED_COLUMNS.map((column) => (isText(item?.[column]) ? item[column] : null));
}
