# Fase 4 — data layer: migrazioni, colonne indicizzate, React Query

Data: 24/11/2026 · Roadmap fase 4. L'utente ha chiesto di fare l'intera fase senza conferme passo per passo, salvo scelte incerte: le decisioni qui sotto sono di Claude e sono segnate come tali.

## Perché
L'utente vuole due cose, da utente:
1. **Più velocità tra una pagina e l'altra.** Oggi ogni pagina, quando si apre, ricarica tutto da zero (spinner), e ogni scrittura fa ricaricare tutte le pagine montate.
2. **Più sicurezza sui dati quando l'app si aggiorna.** Oggi non c'è nessuna versione dello schema: una modifica futura alla forma dei dati non ha un posto dove essere applicata ai dati già salvati (localStorage su Safari, SQLite sulla build nativa) né ai backup vecchi.

**Obiettivi:** cache condivisa tra le pagine con invalidazione mirata; schema versionato con migrazioni che girano una volta sola, in modo atomico, anche sui backup importati; filtri più comuni sulle transazioni spinti in SQL sulla build nativa.
**Non obiettivi:** cambiare l'API `localData.entities.X.*`; aggiornamenti ottimistici; sincronizzazione; nuove feature visibili.
**Anti-obiettivi:** perdere o corrompere dati durante una migrazione; un'app che non parte più perché una migrazione fallisce senza spiegazioni; regressioni nelle pagine esistenti (scroll infinito, regolazione budget, scadenze ricorrenti).

## Stato attuale (rilevato)
- `src/api/localDataClient.js`: tabelle SQLite `id, data_json, created_date, updated_date`; `filter`/`aggregate` fanno `readAll` + filtro/ordinamento in JS. Browser: tutto lo store in `app_budget_local_store_v1`.
- Nessuna versione: `CREATE TABLE IF NOT EXISTS`, backup con `version: 1` mai letto.
- Ogni scrittura lancia `local-data-changed` e `expense-added` su `window`; 7 tra pagine e componenti ascoltano `expense-added` e ricaricano, con contatori `loadSeq` contro le risposte vecchie. `AddExpenseSheet` lancia `expense-added` a mano (doppione).
- React Query è installato e il `QueryClientProvider` è montato, ma nessuno lo usa.

## Ordine
1. Versioning e migrazioni (base per il resto).
2. Colonne indicizzate (sono una migrazione SQLite: usano il punto 1).
3. React Query (il più grosso, tocca quasi tutte le pagine).
*Scelta di Claude:* 2 prima di 3 rispetto a quanto detto in chat, perché vive nello stesso file del punto 1 e si chiude prima di toccare la UI.

## 1. Versioning e migrazioni
- Nuovo `src/lib/migrations.js`, puro e testato:
  - `SCHEMA_VERSION` (numero intero corrente).
  - `MIGRATIONS`: elenco ordinato `{ version, sql?: string[], up?: (data) => data }`. `sql` vale solo su SQLite (cambi di struttura); `up` trasforma i dati, indicizzati per entità (`{ Transaction: [...], Category: [...], ... }`), e vale ovunque.
  - `migrateData(data, fromVersion)` → `{ data, version }`: applica in ordine gli `up` con `version > fromVersion`. Non muta l'input.
  - Una versione più nuova di quella dell'app (`fromVersion > SCHEMA_VERSION`) è un errore esplicito ("I dati sono stati salvati da una versione più recente dell'app"): niente scritture.
- **Dove si legge la versione:** SQLite `PRAGMA user_version` (0 = database esistente senza versione, trattato come versione 1); browser `store.schema_version` (assente = 1); backup `backup.version` (assente = 1).
- **Quando gira:** all'apertura del database/store, una volta sola, prima di qualsiasi lettura (dentro `getSqliteDb` / `getBrowserStore`), e in `importLocalData` sul backup prima di `replaceAllData`.
- **Atomicità:**
  - SQLite: un'unica transazione per tutte le migrazioni pendenti (sql, riscrittura dei record toccati, `PRAGMA user_version`); rollback in caso di errore.
  - Browser: si calcola il nuovo store in memoria e si scrive con un solo `setItem`. Prima, se c'è spazio, si salva una copia dello store vecchio in `app_budget_local_store_premigration` (in try/catch: se non c'è spazio si procede comunque, la scrittura resta atomica).
  - Se una migrazione fallisce l'app mostra l'errore (le letture falliscono come oggi con un toast) e i dati restano com'erano.
- **Export:** il backup scrive `version: SCHEMA_VERSION`.
- **Migrazione v2 (pulizia dati, scelta di Claude):** normalizza gli importi salvati come testo (es. `"12,50"` da versioni vecchie) in numeri con `parseAmount` — `Transaction.amount`, `RecurringTransaction.amount`, `Budget.amount_limit`; un importo non interpretabile resta com'è (non si inventano valori). Toglie il flag `fixed` dalle categorie di tipo entrata (non ha senso lì). Serve anche a provare il meccanismo con un caso vero.

## 2. Colonne indicizzate (solo SQLite)
- Migrazione v3 con `sql`: aggiunge a `transactions` le colonne `date TEXT`, `type TEXT`, `category_id TEXT`, le riempie da `data_json` (`json_extract`) e crea gli indici `idx_transactions_date (date)`, `idx_transactions_type_date (type, date)`, `idx_transactions_category (category_id)`.
- Le colonne si tengono allineate in `create`, `update`, `deleteCategoryCascade` e `replaceAllData` (una sola funzione che ricava le colonne da un record).
- Nuovo `src/lib/sqlWhere.js`, puro e testato: `buildSqlWhere(query)` → `{ where, params }` con solo le condizioni di primo livello su `date` (`$gte/$gt/$lte/$lt` o uguaglianza), `type` (uguaglianza) e `category_id` (uguaglianza, `$in`). Tutto il resto (`$or`, `$regex`, altri campi) resta al filtro JS.
- `filter` e `aggregate` di `Transaction` su SQLite usano `WHERE` per pre-filtrare, poi applicano **sempre** `matches(item, query)` sull'intera query: il risultato è identico a oggi anche se il pre-filtro fosse incompleto. Sul browser non cambia nulla.
- **Limite noto:** la build nativa non è mai stata provata; questa parte è verificata solo con test unitari finché non si fa la build di prova (già in roadmap).

## 3. React Query
- Il data layer non conosce React: espone `subscribeDataChanged(listener)` e chiama i listener dopo ogni scrittura con `{ entityName, action }` (per import e cascata: `{ action: 'import' }` / più entità). Gli eventi `window` `expense-added` e `local-data-changed` spariscono.
- `src/lib/query-client.js`: `staleTime: Infinity` (i dati cambiano solo passando dal data layer, che invalida), `refetchOnWindowFocus: false`, `retry: 1`. In `App.jsx` un solo abbonamento collega le scritture all'invalidazione: chiavi `['entity', entityName]`; import → invalida tutto.
  - *Scelta di Claude:* `staleTime: Infinity` è ciò che rende istantaneo il ritorno a una pagina già vista; il rischio (dati non invalidati) è coperto dal fatto che ogni scrittura passa da `serializeWrite` + notifica.
- Hook in `src/hooks/useLocalData.js`:
  - `useEntityFilter(entityName, query, options, queryOptions)` → chiave `['entity', entityName, 'filter', query, options]`;
  - `useEntityAggregate(entityName, args, queryOptions)` → `['entity', entityName, 'aggregate', args]`;
  - `useToday()`: data locale di oggi che si aggiorna quando l'app torna in primo piano (`visibilitychange`), al posto dei ricaricamenti manuali di Statistiche e Scadenze dopo mezzanotte.
  - Una funzione pura `queryKeysFor(change)` decide quali chiavi invalidare (testata).
- Pagine:
  - Movimenti: `useInfiniteQuery` a blocchi di 50 (offset come `pageParam`), deduplica per id; il ricaricamento dopo una modifica rifà le pagine già caricate, quindi la posizione resta.
  - Home, Budget, Statistiche, Spese ricorrenti, Categorie, riquadro "Da confermare", onboarding budget, foglio "Aggiungi spesa": letture con gli hook; via `loadSeq` e listener manuali.
  - Budget: `ensureMonthBudgets` resta dentro la funzione di caricamento (è idempotente); la regolazione − / + con le bozze locali e il salvataggio ritardato resta com'è.
  - Le scritture restano chiamate dirette a `localData` (niente `useMutation`): l'invalidazione arriva dall'abbonamento. *Scelta di Claude:* meno codice, stesso effetto.

## Test e verifiche
- Vitest: `migrations.test.js`, `sqlWhere.test.js`, `queryKeys` (pura). Il resto dei test esistenti deve restare verde.
- Browser (Safari = localStorage): store senza `schema_version` con importi testuali → si migra una volta, copia premigrazione presente; import di un backup v1 e rifiuto di uno con versione futura; navigazione tra le pagine senza spinner al ritorno; aggiunta/modifica/eliminazione che aggiornano Home, Movimenti, Budget, Statistiche; scroll infinito; regolazione budget.
- Review finale dell'intero diff con un subagent.

## Lasciato al builder
- Nomi interni e struttura dei file oltre a quelli indicati.
- Come gestire nel dettaglio lo stato `loading` delle pagine con gli hook (`isPending` al primo caricamento, nessuno spinner sui ricaricamenti).
