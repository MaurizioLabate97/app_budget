/**
 * Chiavi di React Query per i dati locali. Tutte partono da ["entity", nome],
 * così una scrittura su un'entità invalida in un colpo filtri e aggregazioni.
 */
export const ALL_ENTITIES_KEY = ["entity"];

export const entityKey = (entityName) => ["entity", entityName];

export const filterKey = (entityName, query = {}, options = {}) => [
  ...entityKey(entityName),
  "filter",
  query,
  options,
];

export const aggregateKey = (entityName, args = {}) => [...entityKey(entityName), "aggregate", args];

/** Chiavi da invalidare dopo una scrittura notificata dal data layer. */
export function keysToInvalidate(change) {
  if (!change || change.action === "import") return [ALL_ENTITIES_KEY];

  const names = change.entityNames ?? (change.entityName ? [change.entityName] : []);
  if (!names.length) return [ALL_ENTITIES_KEY];

  return names.map(entityKey);
}
