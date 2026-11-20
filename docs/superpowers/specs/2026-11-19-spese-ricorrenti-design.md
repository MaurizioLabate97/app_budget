# Spese ricorrenti — design

Data: 19/11/2026 · Stato: approvato

## Perché

Affitto e abbonamenti (Spotify, Netflix…) hanno importo fisso e si ripetono. L'utente non vuole reinserirli ogni volta, ma vuole che l'app lo avvisi alla scadenza e che la spesa entri nel budget **solo dopo la sua conferma**.

## Obiettivi / non obiettivi

- **Obiettivi:** modelli di spesa ricorrente (mensile o annuale); avvisi "da confermare" in Dashboard con **Conferma** e **Salta**; pagina di gestione delle ricorrenze.
- **Non obiettivi:** bollette e importi variabili (restano manuali), entrate ricorrenti, frequenza settimanale, notifiche push o elaborazione in background.
- **Da evitare in ogni caso:** doppioni, spese conteggiate prima della conferma, avvisi che ricompaiono dopo essere stati saltati.

## Vincoli

- Solo locale, senza backend. iOS non esegue l'app in background, quindi le scadenze si calcolano all'apertura e recuperano anche quelle arretrate.
- Date `YYYY-MM-DD` locali, solo con gli helper di `src/lib/date.js`. Mai `toISOString()`.
- UI in italiano. Le eliminazioni passano da `ConfirmDialog`.

## Approcci considerati

- **A. Scadenze calcolate al volo (scelto).** Si salva solo il modello. Le scadenze si ricavano dalla regola e si confrontano con i movimenti confermati e con i periodi saltati. Una sola tabella nuova, niente stato da tenere allineato, robusto anche dopo un restore.
- **B. Tabella delle scadenze.** Un record per ogni scadenza, con il suo stato. Scartato: va sincronizzata, e modificare o sospendere una ricorrenza richiede di ripulire i record già creati, il che crea rischio di doppioni.
- **C. `Transaction` con `pending: true`.** Scartato: oggi gli `aggregate` di Dashboard e Budget non escludono i movimenti in sospeso, quindi andrebbero corretti ovunque. In più una scadenza saltata non lascerebbe traccia e verrebbe rigenerata.

## Design

### Dati

Nuova entità `RecurringTransaction` (tabella `recurring_transactions`):

| campo | note |
|---|---|
| `amount` | numero > 0 |
| `category_id`, `category_name` | facoltativi |
| `description`, `merchant_name` | descrizione obbligatoria |
| `frequency` | `monthly` \| `yearly` |
| `start_date` | `YYYY-MM-DD`: fissa il giorno (e per le annuali anche il mese). Predefinita: oggi |
| `end_date` | facoltativa, inclusa |
| `active` | `false` = sospesa, non genera scadenze |
| `skipped_periods` | elenco di chiavi di periodo saltate: `YYYY-MM` (mensili) o `YYYY` (annuali) |

Una scadenza confermata diventa un normale `Transaction` con `type: 'expense'`, `source: 'recurring'`, `recurring_id`, `occurrence_date` e `date = occurrence_date`.

### Regole

- **Periodo:** mese per le mensili, anno per le annuali.
- **Scadenza gestita:** esiste un `Transaction` con lo stesso `recurring_id` e un `occurrence_date` nello stesso periodo, oppure il periodo è in `skipped_periods`. Se si sposta il giorno (es. dal 5 al 10), il periodo già confermato non ricompare.
- **Giorno oltre la fine del mese:** 29, 30 o 31 nei mesi più corti diventano l'ultimo giorno del mese. Il 29/2 nelle annuali diventa il 28/2 negli anni non bisestili.
- **Scadenze da confermare:** quelle con data da `start_date` a `min(oggi, end_date)` incluse, solo per ricorrenze `active` e non gestite. Ordine: data crescente.

### Logica

`src/lib/recurring.js`, con funzioni pure e testate con Vitest:

- `occurrenceDate(rule, periodKey)`
- `periodKey(frequency, dateStr)`
- `getDueOccurrences(recurrings, transactions, today)` → `[{ recurring, date, periodKey }]`

### Data layer (`localDataClient.js`)

- `TABLES.RecurringTransaction = 'recurring_transactions'` e `CREATE TABLE IF NOT EXISTS`, che si crea anche sui DB esistenti.
- Export e restore la includono in automatico. I backup senza questa chiave si importano lo stesso (`?? []`).
- `getCategoryUsage` conta anche le ricorrenze. `deleteCategoryCascade` toglie la categoria anche dalle ricorrenze, nella stessa transazione.

### UI

- **Dashboard:** in alto il riquadro "Da confermare", con una riga per scadenza: descrizione · importo · "in scadenza oggi" oppure "scaduta il G/M".
  - **Conferma** crea il movimento.
  - **Salta** aggiunge il periodo a `skipped_periods`.
  - Il riquadro non compare se non c'è niente da confermare.
- **Altro → "Spese ricorrenti"** (nuova route `/recurring`): elenco delle ricorrenze con prossima scadenza e stato.
  - Dialog di creazione e modifica: importo con `parseAmount`, categoria di spesa, descrizione, esercente, frequenza, data di inizio, data di fine facoltativa.
  - Interruttore per sospendere e riattivare.
  - Eliminazione con `ConfirmDialog`. I movimenti già confermati restano.

## Scelte lasciate a chi sviluppa (fatte da Claude)

- **Conferma** usa l'importo del modello. Se quel mese era diverso, si modifica il movimento dopo.
- **Test:** si aggiunge `vitest` come dipendenza di sviluppo, con lo script `npm test`.
- **Backup:** prima di toccare il data layer si crea uno zip in `backups/`.
