# Spese ricorrenti — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Obiettivo:** modelli di spesa ricorrente (mensile o annuale) con avvisi "Da confermare" in Dashboard (Conferma / Salta) e una pagina per gestirli.

**Architettura:** si salva solo il modello (`RecurringTransaction`). Le scadenze da confermare le calcola una funzione pura (`src/lib/recurring.js`), confrontando le ricorrenze con i `Transaction` confermati (`recurring_id`) e con i `skipped_periods`. La UI usa `localData.entities.*` come le altre pagine e si ricarica con l'evento `expense-added`.

**Stack:** React 18 + Vite (JSX), Tailwind + shadcn/ui, lucide-react, Capacitor SQLite / localStorage, Vitest (nuova dipendenza di sviluppo).

**Spec:** `docs/superpowers/specs/2026-11-19-spese-ricorrenti-design.md`

## Vincoli globali

- Date sempre come stringhe `YYYY-MM-DD` locali, con gli helper di `src/lib/date.js`. **Mai `toISOString()` per ricavare un giorno.** Le funzioni di `recurring.js` ricevono `today` come stringa.
- UI tutta in italiano, importi in visualizzazione con `formatCurrency()`, in input con `parseAmount()` / `formatAmountInput()`.
- Le eliminazioni passano da `ConfirmDialog`, mai da `window.confirm`.
- Non chiamare metodi delle entity dentro `serializeWrite` (deadlock).
- Niente backend né servizi esterni.
- `CLAUDE.md`: chiedere conferma all'utente prima di ogni modifica ai file e di ogni commit. Dopo ogni task: `npm run build` (+ `npm run lint`) e riportare l'esito.
- Prima del Task 2 (data layer): backup zip in `C:\Users\Utente\Desktop\projects\projects_dev\backups\app_budgetNEW_backup_AAAA-MM-GG_HHMM.zip`, senza `node_modules` né `dist`.

## Punti di attenzione in review

1. **Ricorrenza sospesa e poi riattivata dopo mesi:** non deve mostrare tutti i mesi della pausa come scaduti. Alla riattivazione i periodi arretrati non gestiti, escluso quello corrente, vanno in `skipped_periods` (Task 1, `periodsToSkipOnResume`; Task 3).
2. **Doppio tocco su "Conferma":** non deve creare due movimenti. Il pulsante resta disabilitato durante il salvataggio, e un periodo con un movimento già esistente risulta gestito (test nel Task 1).
3. **Giorno spostato** (es. dal 5 al 10) dopo aver già confermato il mese: il mese non deve ricomparire (test nel Task 1).
4. **Restore di un backup**, anche vecchio e senza `RecurringTransaction`: deve funzionare, e le scadenze già confermate nel backup non devono ricomparire (Task 2, verifica manuale).
5. **Data di fine passata o ricorrenza con inizio futuro:** nessuna scadenza fuori dall'intervallo (test nel Task 1).

---

### Task 1: logica delle scadenze + Vitest

**File:**
- Modifica: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)
- Crea: `src/lib/recurring.js`
- Test: `src/lib/recurring.test.js`

**Interfacce prodotte:**
- `periodKey(frequency: 'monthly'|'yearly', date: string) -> string`: `'2026-03'` oppure `'2026'`
- `occurrenceDate(recurring, key: string) -> string`: la data `YYYY-MM-DD` della scadenza in quel periodo, con il giorno (e per le annuali il mese) preso da `start_date` e limitato all'ultimo giorno del mese
- `getDueOccurrences(recurrings: object[], transactions: object[], today: string) -> { recurring, date: string, periodKey: string }[]`: solo ricorrenze `active !== false`, scadenze da `start_date` a `min(today, end_date)` incluse, escluse quelle gestite (movimento con lo stesso `recurring_id` e `periodKey(frequency, occurrence_date)` uguale, oppure periodo in `skipped_periods`), in ordine di data crescente
- `nextOccurrence(recurring, today: string) -> string|null`: la prima scadenza ≥ today entro `end_date`, oppure `null`
- `periodsToSkipOnResume(recurring, transactions, today) -> string[]`: le chiavi dei periodi arretrati non gestiti, escluso quello di `today`, calcolate come se la ricorrenza fosse attiva

- [ ] **Passo 1:** `npm install -D vitest`, aggiungi lo script `test`.
- [ ] **Passo 2: scrivi i test che falliscono** in `src/lib/recurring.test.js`:

```js
const rent = { id: 'r1', frequency: 'monthly', start_date: '2026-01-31', active: true, amount: 650, description: 'Affitto' };
const tx = (id, occ) => ({ id: 't' + occ, recurring_id: id, occurrence_date: occ });

test('fine mese: 31 → 28/2, 31/3', () => {
  expect(occurrenceDate(rent, '2026-02')).toBe('2026-02-28');
  expect(occurrenceDate(rent, '2028-02')).toBe('2028-02-29');
  expect(occurrenceDate(rent, '2026-03')).toBe('2026-03-31');
});
test('annuale 29/2 in anno non bisestile → 28/2', () => {
  expect(occurrenceDate({ frequency: 'yearly', start_date: '2028-02-29' }, '2029')).toBe('2029-02-28');
});
test('scadenze fino a oggi incluso, ordinate', () => {
  const due = getDueOccurrences([rent], [], '2026-03-31');
  expect(due.map((d) => d.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
});
test('confermata o saltata non ricompare', () => {
  const r = { ...rent, skipped_periods: ['2026-02'] };
  expect(getDueOccurrences([r], [tx('r1', '2026-01-31')], '2026-03-31').map((d) => d.periodKey)).toEqual(['2026-03']);
});
test('giorno spostato: il mese già confermato resta gestito', () => {
  const moved = { ...rent, start_date: '2026-01-10' };
  expect(getDueOccurrences([moved], [tx('r1', '2026-01-31')], '2026-01-31')).toEqual([]);
});
test('sospesa, end_date passata, inizio futuro → niente', () => {
  expect(getDueOccurrences([{ ...rent, active: false }], [], '2026-03-31')).toEqual([]);
  expect(getDueOccurrences([{ ...rent, end_date: '2026-01-31' }], [], '2026-03-31')).toHaveLength(1);
  expect(getDueOccurrences([{ ...rent, start_date: '2026-05-01' }], [], '2026-03-31')).toEqual([]);
});
test('movimenti di altre ricorrenze ignorati', () => {
  expect(getDueOccurrences([rent], [tx('altro', '2026-01-31')], '2026-01-31')).toHaveLength(1);
});
test('nextOccurrence', () => {
  expect(nextOccurrence(rent, '2026-02-01')).toBe('2026-02-28');
  expect(nextOccurrence({ ...rent, end_date: '2026-01-31' }, '2026-02-01')).toBeNull();
});
test('periodsToSkipOnResume esclude il periodo corrente e quelli gestiti', () => {
  const r = { ...rent, active: false };
  expect(periodsToSkipOnResume(r, [tx('r1', '2026-01-31')], '2026-04-15')).toEqual(['2026-02', '2026-03']);
});
```

- [ ] **Passo 3:** `npm test` → FAIL (moduli o funzioni mancanti).
- [ ] **Passo 4:** implementa `src/lib/recurring.js`. Per le date usa `new Date(y, m - 1, d)` più `toLocalDateString` da `src/lib/date.js`. L'ultimo giorno del mese si ottiene con `new Date(y, m, 0).getDate()`. Scorri i periodi dal periodo di `start_date` a quello del limite.
- [ ] **Passo 5:** `npm test` → PASS. `npm run build` e `npm run lint` → OK.
- [ ] **Passo 6:** commit (dopo conferma): `Add recurring occurrence logic with Vitest tests`

### Task 2: data layer

**File:**
- Modifica: `src/api/localDataClient.js` (`TABLES`, `DEFAULTS`, `CREATE TABLE`, `getCategoryUsage`, `deleteCategoryCascade`)
- Modifica: `src/pages/categories.jsx` (testo di conferma eliminazione)

**Interfacce:**
- Produce: `localData.entities.RecurringTransaction` (stessa API delle altre entity). `DEFAULTS.RecurringTransaction = { frequency: 'monthly', active: true, skipped_periods: [] }`.
- `getCategoryUsage(id) -> { transactions, budgets, recurrings }`
- `deleteCategoryCascade(id) -> { transactions, budgets, recurrings }`: le ricorrenze collegate perdono `category_id` / `category_name` (riusa `uncategorize`, senza `is_categorized` per le ricorrenze o lasciandolo innocuo), nella stessa transazione SQLite e nello stesso salvataggio browser.

- [ ] **Passo 1:** backup zip (vedi i vincoli globali).
- [ ] **Passo 2:** `TABLES.RecurringTransaction = 'recurring_transactions'`, `DEFAULTS` come sopra, `CREATE TABLE IF NOT EXISTS recurring_transactions (...)` con le stesse colonne delle altre tabelle.
- [ ] **Passo 3:** estendi `getCategoryUsage` e `deleteCategoryCascade`. In `categories.jsx` aggiungi la riga `"N spesa ricorrente resterà / N spese ricorrenti resteranno senza categoria"` quando `usage.recurrings > 0`.
- [ ] **Passo 4:** verifica manuale con `npm run dev` nel browser:
  - crea una ricorrenza da console (`localData` importato nella pagina, oppure dopo il Task 3);
  - fai l'export: il backup contiene `RecurringTransaction`;
  - ripristina un backup vecchio senza quella chiave: ok;
  - elimina una categoria usata da una ricorrenza: la ricorrenza resta senza categoria.
- [ ] **Passo 5:** `npm run build`, `npm run lint` → OK. Commit: `Add RecurringTransaction entity to local data layer`

### Task 3: pagina "Spese ricorrenti"

**File:**
- Crea: `src/pages/recurring.jsx`, `src/components/recurring/recurringdialog.jsx`
- Modifica: `src/App.jsx` (route `/recurring`), `src/pages/more.jsx` (voce `{ to: '/recurring', icon: Repeat, label: 'Spese ricorrenti', desc: 'Affitto, abbonamenti e altre spese fisse' }` come prima voce)

**Interfacce:**
- Usa: `nextOccurrence`, `periodsToSkipOnResume` (Task 1), `localData.entities.RecurringTransaction` (Task 2), `ConfirmDialog`, `formatCurrency`, `parseAmount`, `formatAmountInput`, `todayLocal`.
- `RecurringDialog({ open, onOpenChange, categories, recurring = null, onSaved })`

- [ ] **Passo 1: dialog**, sullo schema di `addtransactiondialog.jsx` ma solo per le spese (niente switch Spesa/Entrata). Campi:
  - Importo (€)
  - Descrizione (obbligatoria)
  - Esercente (facoltativo)
  - Categoria: solo `type === 'expense'`
  - Frequenza: `Select` con "Mensile" / "Annuale"
  - Data di inizio: default `todayLocal()`
  - Data di fine (facoltativa)

  Validazione con toast:
  - "Inserisci un importo valido"
  - "Inserisci una descrizione"
  - "La data di fine deve essere successiva all'inizio"

  Salvataggio: `create` / `update` con `category_name` ricavato dalla categoria. Titoli: "Nuova spesa ricorrente" / "Modifica spesa ricorrente". Toast: "Spesa ricorrente aggiunta" / "aggiornata".
- [ ] **Passo 2: pagina.** Titolo "Spese ricorrenti", pulsante "Aggiungi".
  - Lista ordinata per descrizione. Ogni riga mostra:
    - icona della categoria
    - descrizione
    - importo e "Mensile" / "Annuale"
    - "Prossima: G/M/AAAA" da `nextOccurrence`, oppure "Terminata"
    - "Sospesa" se inattiva
  - Azioni sulla riga:
    - tocco → modifica
    - interruttore attiva/sospendi: alla riattivazione `update(id, { active: true, skipped_periods: [...existing, ...periodsToSkipOnResume(r, transactions, todayLocal())] })`
    - elimina → `ConfirmDialog` "Eliminare questa spesa ricorrente? I movimenti già registrati restano."
  - Stato vuoto: "Nessuna spesa ricorrente. Aggiungi affitto e abbonamenti per ricevere un avviso alla scadenza."
  - Ricarica su `expense-added`.
- [ ] **Passo 3:** route e voce in Altro.
- [ ] **Passo 4:** verifica nel browser (`npm run dev`):
  - creazione, modifica e sospensione;
  - riattivazione dopo aver spostato `start_date` indietro di 3 mesi: i mesi arretrati non vengono proposti;
  - eliminazione con conferma.

  Poi `npm run build`, `npm run lint`.
- [ ] **Passo 5:** commit: `Add recurring expenses management page`

### Task 4: riquadro "Da confermare" in Dashboard

**File:**
- Crea: `src/components/recurring/dueoccurrences.jsx`
- Modifica: `src/pages/dashboard.jsx` (inseriscilo in cima al contenuto)

**Interfacce:**
- `DueOccurrences()`: componente autonomo. Carica `RecurringTransaction` e i `Transaction` con `source: 'recurring'`, calcola `getDueOccurrences(..., todayLocal())` e si ricarica su `expense-added`.

- [ ] **Passo 1:** riquadro "Da confermare". Ogni riga mostra:
  - descrizione
  - `formatCurrency(amount)`
  - "in scadenza oggi" se `date === today`, altrimenti "scaduta il G/M"

  Se la lista è vuota il componente restituisce `null`.
- [ ] **Passo 2: Conferma.** `Transaction.create` con:

  ```js
  {
    type: 'expense',
    amount,
    date,
    occurrence_date: date,
    recurring_id,
    source: 'recurring',
    description,
    merchant_name,
    category_id,
    category_name,
    is_categorized: !!category_id,
  }
  ```

  Toast "Spesa registrata". Il pulsante della riga resta disabilitato durante il salvataggio, cioè tiene la chiave `recurring.id + periodKey`.
- [ ] **Passo 3: Salta.** `RecurringTransaction.update(id, { skipped_periods: [...(r.skipped_periods || []), periodKey] })`. Toast "Scadenza saltata".
- [ ] **Passo 4:** verifica nel browser:
  - ricorrenza con inizio 2 mesi fa → 3 righe (2 scadute e 1 oggi, se il giorno coincide);
  - Conferma → il movimento compare in Movimenti e nel budget, la riga sparisce;
  - Salta → la riga sparisce e non torna dopo il reload;
  - doppio tocco veloce → un solo movimento.

  Poi `npm run build`, `npm run lint`, `npm test`.
- [ ] **Passo 5:** aggiorna lo "Stato" in `CLAUDE.md`: spese ricorrenti fatte, roadmap da rinumerare. Commit: `Show due recurring expenses on dashboard`
