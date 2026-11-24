import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { localData } from "@/api/localDataClient";
import { todayLocal } from "@/lib/date";
import { aggregateKey, filterKey } from "@/lib/queryKeys";

/** `localData.entities[entityName].filter(query, options)` con cache. Dati: `{ items, total }`. */
export function useEntityFilter(entityName, query = {}, options = {}, queryOptions = {}) {
  return useQuery({
    queryKey: filterKey(entityName, query, options),
    queryFn: () => localData.entities[entityName].filter(query, options),
    ...queryOptions,
  });
}

/** `localData.entities[entityName].aggregate(args)` con cache. Dati: `{ rows }`. */
export function useEntityAggregate(entityName, args = {}, queryOptions = {}) {
  return useQuery({
    queryKey: aggregateKey(entityName, args),
    queryFn: () => localData.entities[entityName].aggregate(args),
    ...queryOptions,
  });
}

/**
 * Data locale di oggi ("YYYY-MM-DD"). Su iPhone l'app resta aperta in background:
 * quando torna in primo piano la data si aggiorna, e con lei tutto ciò che ne dipende.
 */
export function useToday() {
  const [today, setToday] = useState(todayLocal);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setToday(todayLocal());
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return today;
}
