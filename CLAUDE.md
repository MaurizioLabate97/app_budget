# App Budget — istruzioni per Claude

App di budgeting **personale e solo locale**: React + Vite + Capacitor, da usare sull'iPhone dell'utente.
Obiettivo: tracciare in modo semplice le spese, che siano giornaliere, periodiche o una tantum.

## Regole di lavoro (importanti)

- **Chiedi sempre conferma prima di modificare file o eseguire comandi che cambiano qualcosa** (install, git commit/rm, eliminazioni). Prima spiega cosa farai: file toccati, cosa cambia e perché. Lettura, build, lint e test si possono lanciare liberamente.
- Lavora per **modifiche piccole e verificabili**: una feature o un fix alla volta, poi proponi il messaggio di commit.
- Dopo ogni modifica lancia `npm run build` (e `npm run lint` se tocchi molto codice) e riporta l'esito.
- **Backup:** prima di modifiche grosse (refactor, cambi al data layer, migrazioni) crea uno zip del progetto, senza `node_modules` e `dist`, in `C:\Users\Utente\Desktop\projects\projects_dev\backups\` con nome `app_budgetNEW_backup_AAAA-MM-GG_HHMM.zip`. Il primo backup è del 16/11/2026.
- Non aggiungere autenticazione, backend, servizi esterni o sincronizzazione cloud senza una richiesta esplicita.
- L'utente è uno sviluppatore esperto: parla in **italiano**, con tono informale e diretto, senza spiegare le basi.
- La UI dell'app è **tutta in italiano**: niente nuove stringhe in inglese.

## Contesto tecnico

- **Stack:** React 18 + Vite, JSX (niente TypeScript), react-router v6, Tailwind 3 + shadcn/ui, lucide-react, recharts, Capacitor 7.
- **Repo git:** questa cartella (`app_budget_localfirst`, branch `main`, remote `origin`). Esiste anche un repo git vuoto nella cartella padre `app_budgetNEW`: non usarlo.
- **Target principale: iOS (iPhone).** L'utente lavora su Windows e **non ha un Mac**. Android è secondario.
  - Sviluppo e test: `npm run dev` sul PC, poi l'utente apre `http://<IP-PC>:5173` da Safari sull'iPhone (`vite.config.js` ha già `host: '0.0.0.0'`). In Safari l'app usa il ramo **browser** (localStorage), non SQLite.
  - Build nativa iOS: da decidere più avanti, tra GitHub Actions su runner macOS (o un servizio cloud) con Sideloadly e Apple ID gratuito, oppure Apple Developer con TestFlight. Va fatta almeno una build nativa di prova a metà sviluppo, per verificare SQLite, Share/Filesystem e safe area.

## Architettura

- `src/api/localDataClient.js` è l'**unico data layer**, con un'API stile `localData.entities.X.list/filter/get/create/update/delete/aggregate`.
  - Nativo: `@capacitor-community/sqlite`, ogni record salvato come blob `data_json`; filtri e aggregazioni in JS. Le transazioni hanno anche le colonne indicizzate `date`, `type`, `category_id` (da tenere allineate a `data_json` su ogni scrittura): `filter`/`aggregate` pre-filtrano in SQL con `buildSqlWhere` (`src/lib/sqlWhere.js`) e poi applicano comunque l'intera query in JS.
  - Browser: tutto lo store in un'unica chiave localStorage (`STORE_KEY`).
  - Le scritture sono serializzate da `serializeWrite`. **Non chiamare metodi delle entity dentro `serializeWrite`**, finisce in deadlock.
  - **Schema versionato** (`src/lib/migrations.js`): versione in `PRAGMA user_version` (SQLite), `store.schema_version` (browser) e `backup.version`; se manca vale 1. Le migrazioni girano una volta, in ordine e in modo atomico all'apertura dei dati e sui backup importati; i dati di una versione più recente vengono rifiutati. **Una modifica alla forma dei dati va sempre aggiunta in coda a `MIGRATIONS`**, mai fatta a mano. Le migrazioni SQLite sono testate su SQLite vero con `sql.js` (solo dev).
  - **Letture con React Query:** dopo ogni scrittura il data layer avvisa chi è iscritto con `subscribeDataChanged`; `src/lib/query-client.js` invalida le chiavi `["entity", nome]` (tutto dopo un restore). Le pagine leggono con gli hook di `src/hooks/useLocalData.js` (`useEntityFilter`, `useEntityAggregate`, `useToday`); `staleTime: Infinity`, quindi **ogni modifica ai dati deve passare dal data layer**. Le scritture restano chiamate dirette a `localData`.
  - Funzioni extra: `exportLocalData` / `importLocalData` (backup JSON), `getCategoryUsage`, `deleteCategoryCascade` (transazioni rese "senza categoria" e budget eliminati, tutto in un'unica transazione SQLite).
- Entità: `Transaction`, `Category`, `Budget`, `BankAccount` (quest'ultima non usata).
- **Date:** le date sono stringhe `YYYY-MM-DD` locali. Usa sempre gli helper di `src/lib/date.js` (`todayLocal`, `toLocalDateString`, `getMonthRange`). **Mai `toISOString()` per ricavare un giorno**: in Italia (UTC+1/+2) restituisce il giorno sbagliato.
- **Importi:** i campi sono `type="text" inputMode="decimal"`, il parsing passa da `parseAmount()` e la visualizzazione in modifica da `formatAmountInput()` (`src/lib/format.js`). `formatCurrency()` usa `it-IT` (es. `1.234,50 €`).
- **Eliminazioni:** chiedono sempre conferma con `src/components/ConfirmDialog.jsx`, non con `window.confirm`.
- Pagine in `src/pages/`: dashboard, stats, transactions (in UI "Movimenti"), budgets, categories, more (backup/restore), bankaccount (placeholder).

## Stato (aggiornato al 24/11/2026)

**Fatto:**
- Restore dei backup sistemato (prima era rotto su nativo e su web).
- Bug del fuso orario nei range mensili e nella data di default.
- Modifica delle transazioni dalla Dashboard.
- Conferme di eliminazione ed eliminazione a cascata delle categorie.
- UI in italiano con formati `it-IT`.
- Importi con la virgola.
- `package.json` ripulito: da 67 a 22 dipendenze, tolta anche `nitro`. Config di ESLint e jsconfig corrette.
- Budget ricorrenti (20/11/2026): ogni mese si ripropongono le voci "Ogni mese" dell'ultimo mese con budget (`src/lib/budgets.js` + `budgetActions.js`, testati); voci "Solo questo mese" (`Budget.recurring: false`); pagina Budget "tocca e regola" con − / + (passo 10 €) e importo scrivibile a mano; pannello "Nuova voce" (crea la categoria se non c'è, blocca i doppioni per categoria e mese); popup al primo avvio con Mutuo, Alcol e Spesa. I mesi già preparati sono segnati in localStorage (`app_budget_budget_months_v1`, azzerato dopo un restore). Design in `docs/superpowers/specs/2026-11-20-budget-ricorrenti-design.md`.
- Spese ricorrenti (19/11/2026): entità `RecurringTransaction`, scadenze calcolate da `src/lib/recurring.js` (testato con Vitest, `npm test`), riquadro "Da confermare" in Dashboard (Conferma / Salta), pagina Altro → Spese ricorrenti (`/recurring`). Design in `docs/superpowers/specs/2026-11-19-spese-ricorrenti-design.md`.
- Statistiche (24/11/2026): pagina `/stats` (da Altro e da Home) con la classifica delle categorie di spesa non fisse su 3/6/12 mesi, media al mese, confronto col periodo prima e dettaglio mese per mese. Calcoli puri in `src/lib/stats.js` (testati). Flag facoltativo `Category.fixed` ("Spesa fissa" nel dialog della categoria); se manca vale la regola sul nome (mutuo, affitto, bollette, luce, gas, acqua, condominio). Design in `docs/superpowers/specs/2026-11-24-statistiche-design.md`.
- Pulizia fase 2 (19/11/2026): rimossi componenti, hooks e utils inutilizzati e i componenti shadcn non usati. In `src/components/ui/` restano solo alert-dialog, button, card, dialog, drawer, input, label, popover, select, toast, toaster e use-toast. Il lint passa senza errori né warning.
- Fase 4, data layer (24/11/2026): schema versionato con migrazioni (v2 converte in numeri gli importi salvati come testo, v3 aggiunge le colonne indicizzate su SQLite), React Query al posto degli eventi `expense-added` (tornando su una pagina già vista i dati sono subito pronti). Il ramo SQLite è verificato solo con i test su `sql.js`, non ancora su un telefono.

**Note:**
- `src/components/charts/balance.jsx` e `monthlytrendchart.jsx` non sono usati, ma vanno **tenuti** per le statistiche.
- Il bundle supera i 500 kB (avviso di Vite): valutare il code splitting con `import()` dinamici.
- `npm audit` segnala 5 vulnerabilità moderate, non ancora valutate.

**Roadmap:**
- **Fase 3, feature:**
  1. ~~Spese ricorrenti~~ (fatto).
  2. ~~Budget ricorrenti~~ (fatto).
  3. ~~Categorie di default al primo avvio~~ (fatto con il popup dei budget).
  4. ~~Paginazione dei movimenti~~ (fatto: scroll infinito a blocchi di 50).
  5. ~~Statistiche e grafici di trend~~ (fatto: pagina Statistiche "dove spendi di più").
  6. ~~Ricerca anche sull'esercente~~ (fatto: cerca in esercente, descrizione e categoria mentre scrivi).
  7. ~~Riga transazione meno affollata su mobile~~ (fatto: tocca la riga per modificare, chip categoria, Elimina nella modifica).
- ~~**Fase 4, data layer:**~~ (fatto il 24/11/2026: React Query, colonne indicizzate, migrazioni). Design in `docs/superpowers/specs/2026-11-24-fase4-data-layer-design.md`.
- **Prossimo:** build nativa di prova (in ritardo: serve a verificare SQLite, migrazioni e colonne indicizzate sul telefono).
- **Rifiniture finali** (l'utente le vuole alla fine, dopo la fase 4): toggle per la dark mode; bundle oltre 500 kB; `npm audit`; valutare `allowBackup` e il permesso `INTERNET` su Android.

**Evolutive da mostrare all'utente a fine progetto** (non proporle prima):
- Import dell'estratto conto CSV a fine mese, con confronto nell'app (stesso importo, data entro 2-3 giorni): propone solo le spese mancanti, con esercente precompilato e categoria dedotta dalle `keywords`. Serve un CSV di esempio della banca. L'inserimento manuale quotidiano resta il metodo principale.
- Comandi Rapidi iOS + Apple Wallet: l'automazione "Transazione" apre l'app con importo ed esercente già compilati. Vale solo per i pagamenti con Apple Pay e richiede la build nativa con uno schema URL. Dettagli da verificare.
- Scartato: open banking PSD2, perché richiede un backend o un aggregatore.

Analisi completa iniziale: documento `claude/analisi-app-budget.md` nel Progetto "App Budget" su claude.ai.

## Comandi

- `npm install`
- `npm run dev`: server Vite, raggiungibile anche dall'iPhone in LAN
- `npm run build`
- `npm test`: test Vitest (logica pura, migrazioni anche su SQLite via sql.js)
- `npm run lint` / `npm run lint:fix`
- `npm run cap:sync`: build più `cap sync`
- `npm run ios` (serve macOS) / `npm run android`
