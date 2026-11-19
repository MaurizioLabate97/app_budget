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
  - Nativo: `@capacitor-community/sqlite`, ogni record salvato come blob `data_json`; filtri e aggregazioni in JS.
  - Browser: tutto lo store in un'unica chiave localStorage (`STORE_KEY`).
  - Le scritture sono serializzate da `serializeWrite`. **Non chiamare metodi delle entity dentro `serializeWrite`**, finisce in deadlock.
  - Dopo ogni scrittura parte l'evento `expense-added`, che le pagine ascoltano per ricaricarsi.
  - Funzioni extra: `exportLocalData` / `importLocalData` (backup JSON), `getCategoryUsage`, `deleteCategoryCascade` (transazioni rese "senza categoria" e budget eliminati, tutto in un'unica transazione SQLite).
- Entità: `Transaction`, `Category`, `Budget`, `BankAccount` (quest'ultima non usata).
- **Date:** le date sono stringhe `YYYY-MM-DD` locali. Usa sempre gli helper di `src/lib/date.js` (`todayLocal`, `toLocalDateString`, `getMonthRange`). **Mai `toISOString()` per ricavare un giorno**: in Italia (UTC+1/+2) restituisce il giorno sbagliato.
- **Importi:** i campi sono `type="text" inputMode="decimal"`, il parsing passa da `parseAmount()` e la visualizzazione in modifica da `formatAmountInput()` (`src/lib/format.js`). `formatCurrency()` usa `it-IT` (es. `1.234,50 €`).
- **Eliminazioni:** chiedono sempre conferma con `src/components/ConfirmDialog.jsx`, non con `window.confirm`.
- Pagine in `src/pages/`: dashboard, transactions (in UI "Movimenti"), budgets, categories, more (backup/restore), bankaccount (placeholder).

## Stato (aggiornato al 19/11/2026)

**Fatto:**
- Restore dei backup sistemato (prima era rotto su nativo e su web).
- Bug del fuso orario nei range mensili e nella data di default.
- Modifica delle transazioni dalla Dashboard.
- Conferme di eliminazione ed eliminazione a cascata delle categorie.
- UI in italiano con formati `it-IT`.
- Importi con la virgola.
- `package.json` ripulito: da 67 a 22 dipendenze, tolta anche `nitro`. Config di ESLint e jsconfig corrette.

**Da completare (pulizia, fase 2):** se `src/components/ui/accordion.jsx` esiste ancora, l'utente non ha ancora eseguito la pulizia. Restano da eliminare con `git rm`, dopo conferma dell'utente:
- `localDataClientBackup.js`
- `src/components/GoogleIcon.jsx`, `src/components/StatCard.jsx`, `src/components/UserNotRegisteredError.jsx`
- `src/hooks/` (tutta la cartella), `src/utils/` (tutta la cartella)
- in `src/components/ui/`: accordion, alert, aspect-ratio, avatar, badge, breadcrumb, calendar, carousel, chart, checkbox, collapsible, context-menu, dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, progress, radio-group, resizable, scroll-area, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip (`.jsx`)

Poi `npm install` per aggiornare `package-lock.json`, `npm run build` e `npm run lint`. Il lint ora copre tutto `src` (tranne `components/ui`) e può segnalare warning nuovi. **Tieni** `src/components/charts/balance.jsx` e `monthlytrendchart.jsx`: non sono usati, ma serviranno per le statistiche.

**Roadmap:**
- **Fase 3, feature:**
  1. **Spese ricorrenti**: è la priorità.
  2. Budget ricorrenti oppure "copia dal mese precedente", senza duplicati per categoria e mese.
  3. Categorie di default al primo avvio.
  4. Paginazione: oggi le transazioni sono limitate a 100.
  5. Statistiche e grafici di trend.
  6. Ricerca anche sull'esercente.
  7. Riga transazione meno affollata su mobile.
- **Fase 4, data layer:** passare a React Query (già installato ma inutilizzato) al posto degli eventi window; colonne indicizzate (`date`, `type`, `category_id`); versioning dello schema con migrazioni.
- **Altro:** toggle per la dark mode; valutare `allowBackup` e il permesso `INTERNET` su Android.

Analisi completa iniziale: documento `claude/analisi-app-budget.md` nel Progetto "App Budget" su claude.ai.

## Comandi

- `npm install`
- `npm run dev`: server Vite, raggiungibile anche dall'iPhone in LAN
- `npm run build`
- `npm run lint` / `npm run lint:fix`
- `npm run cap:sync`: build più `cap sync`
- `npm run ios` (serve macOS) / `npm run android`
