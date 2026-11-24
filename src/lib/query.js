// Filtri in stile Mongo usati dal data layer locale (localDataClient.js).

function matchesOperators(actual, expected) {
  return Object.entries(expected).every(([op, value]) => {
    if (op === "$gte") return actual >= value;
    if (op === "$gt") return actual > value;
    if (op === "$lte") return actual <= value;
    if (op === "$lt") return actual < value;
    if (op === "$ne") return actual !== value;
    if (op === "$in") return Array.isArray(value) && value.includes(actual);

    if (op === "$regex") {
      try {
        const flags = expected.$options?.includes("i") ? "i" : "";
        return new RegExp(value, flags).test(String(actual ?? ""));
      } catch {
        return false;
      }
    }

    if (op === "$options") return true;
    return false;
  });
}

/**
 * Vero se `item` soddisfa tutte le condizioni di `query`.
 * `$or: [subquery, ...]` è vera se almeno una subquery è vera.
 */
export function matches(item, query = {}) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === "$or") {
      return Array.isArray(expected) && expected.some((sub) => matches(item, sub));
    }

    const actual = item[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      return matchesOperators(actual, expected);
    }
    return actual === expected;
  });
}
