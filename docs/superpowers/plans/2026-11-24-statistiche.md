# Statistiche "dove spendo di più" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pagina `/stats` con la classifica delle categorie di spesa non fisse su 3/6/12 mesi, più il flag "Spesa fissa" sulle categorie.

**Architecture:** Tutti i calcoli in funzioni pure in `src/lib/stats.js` (testate con Vitest). La pagina legge le spese con `Transaction.filter` sul range periodo + periodo precedente e le categorie con `Category.filter`, poi chiama `computeStats`. Il flag è il campo facoltativo `Category.fixed`, con fallback sul nome.

**Tech Stack:** React 18 + Vite (JSX), Tailwind + shadcn/ui, lucide-react, recharts, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-24-statistiche-design.md`

## Global Constraints

- UI tutta in italiano; importi con `formatCurrency` (it-IT).
- Date come stringhe locali `YYYY-MM-DD`; helper di `src/lib/date.js`; **mai `toISOString()` per ricavare un giorno**.
- Data layer invariato: solo `localData.entities.X.filter/update/create`; niente modifiche a `localDataClient.js`.
- Nessuna migrazione: `Category.fixed` è facoltativo, i record esistenti funzionano così come sono.
- Eliminazioni/conferme con `ConfirmDialog`, mai `window.confirm` (qui non servono).
- Dopo ogni task: `npm run build`, `npm run lint`, `npm test` puliti.
- Commit solo dopo l'ok dell'utente (regola di CLAUDE.md); messaggi che terminano con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Nessun dato** (app nuova, o periodo senza spese variabili): niente `NaN`/`Infinity`, stato vuoto "Nessuna spesa nel periodo". → test `computeStats senza movimenti` (Task 1).
2. **Spesa con `category_id` di una categoria eliminata o assente**: finisce in "Senza categoria", non sparisce né rompe. → test (Task 1).
3. **Periodo a cavallo d'anno** (gennaio con 3 mesi): range e mesi del grafico corretti. → test `periodRange` di gennaio (Task 1).
4. **Mesi senza spese dentro il periodo**: il grafico mese per mese li mostra a 0, in ordine cronologico. → test `monthly` con buchi (Task 1).
5. **Flag esplicito contro regola sul nome** (Mutuo con `fixed: false` torna in classifica; Ristoranti con `fixed: true` esce). → test `isFixedCategory` (Task 1).

---

### Task 1: Calcoli delle statistiche (`src/lib/stats.js`)

**Files:**
- Create: `src/lib/stats.js`
- Test: `src/lib/stats.test.js`

**Interfaces:**
- Produces:
  - `isFixedCategory(category: object|null|undefined) -> boolean`
  - `periodRange(today: string, months: number) -> { start: string, end: string, prevStart: string }` — `start` = primo giorno del mese di (mese di `today` − months + 1); `end` = primo giorno del mese dopo `today` (esclusivo); `prevStart` = `start` − months mesi. Tutte `YYYY-MM-DD`.
  - `usageStart(transactions: object[], categoriesById: Map<string, object>) -> string|null` — data minima tra le spese (`type === "expense"`) la cui categoria non è fissa (senza categoria o categoria assente = non fissa).
  - `effectiveMonths(from: string, to: string, start: string|null, today: string) -> number` — mesi effettivi nell'intervallo `[from, to)` tagliato a sinistra da `start` e a destra da `today` (incluso). Ogni mese pieno vale 1; un mese tagliato vale giorni coperti / giorni del mese. Restituisce 0 se `start` è null o non c'è sovrapposizione; se il risultato è tra 0 e 1 restituisce 1.
  - `computeStats({ transactions, categories, today, months }) -> { avg: number, prevAvg: number|null, fixedAvg: number, fixedNames: string[], rows: Row[] }`, con `Row = { categoryId: string|null, name: string, color: string, icon: string, avg: number, share: number, delta: number|null, monthly: { key: "YYYY-MM", total: number }[], top: object[] }`.
    - Solo spese; le entrate sono ignorate. Spese con categoria fissa → solo in `fixedAvg`/`fixedNames` (nomi unici, ordinati it-IT).
    - `avg` di riga = totale nel periodo ÷ `effectiveMonths(start, end, usage, today)`; `avg` complessivo = somma delle righe; `share` = avg riga / avg complessivo.
    - `prevAvg` / `delta` usano `effectiveMonths(prevStart, start, usage, today)`; se è 0 → `prevAvg: null` e tutti i `delta: null`. `delta` di riga = (avg − prevAvgRiga) / prevAvgRiga, `null` se il periodo precedente della categoria è 0.
    - `rows` ordinate per `avg` decrescente; righe con totale 0 escluse. "Senza categoria": `categoryId: null`, `color: "#94a3b8"`, `icon: "Tag"`.
    - `monthly`: un elemento per ogni mese del periodo, in ordine cronologico, zero-filled.
    - `top`: le 5 spese più grosse della categoria nel periodo, per importo decrescente.
    - Periodo vuoto: `{ avg: 0, prevAvg: null, fixedAvg: 0, fixedNames: [], rows: [] }`.

Regola sul nome per `isFixedCategory` (solo se `category.fixed` non è booleano), sul nome in minuscolo: `/mutuo|affitto|bollett|acqua|condomin|(^|\s)(luce|gas)(\s|$)/`.

- [ ] **Step 1: Scrivi i test in `src/lib/stats.test.js`**

```js
import { describe, it, expect } from "vitest";
import { isFixedCategory, periodRange, usageStart, effectiveMonths, computeStats } from "./stats";

describe("isFixedCategory", () => {
  it("riconosce le fisse dal nome", () => {
    expect(isFixedCategory({ name: "Mutuo" })).toBe(true);
    expect(isFixedCategory({ name: "Bollette luce" })).toBe(true);
    expect(isFixedCategory({ name: "Gas" })).toBe(true);
    expect(isFixedCategory({ name: "Gasolio" })).toBe(false);
    expect(isFixedCategory({ name: "Ristoranti" })).toBe(false);
    expect(isFixedCategory(null)).toBe(false);
  });
  it("il flag esplicito vince sul nome", () => {
    expect(isFixedCategory({ name: "Mutuo", fixed: false })).toBe(false);
    expect(isFixedCategory({ name: "Ristoranti", fixed: true })).toBe(true);
  });
});

describe("periodRange", () => {
  it("3 mesi a novembre", () => {
    expect(periodRange("2026-11-24", 3)).toEqual({ start: "2026-09-01", end: "2026-12-01", prevStart: "2026-06-01" });
  });
  it("a cavallo d'anno", () => {
    expect(periodRange("2026-01-10", 3)).toEqual({ start: "2025-11-01", end: "2026-02-01", prevStart: "2025-08-01" });
  });
});

describe("effectiveMonths", () => {
  const T = "2026-11-24";
  it("mesi pieni più il mese corrente in proporzione", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", "2026-01-05", T)).toBeCloseTo(2.8);
  });
  it("il mese di inizio conta dal giorno della prima spesa", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", "2026-10-20", T)).toBeCloseTo(12 / 31 + 24 / 30);
  });
  it("meno di un mese vale 1", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", "2026-11-20", T)).toBe(1);
  });
  it("0 senza inizio o senza sovrapposizione", () => {
    expect(effectiveMonths("2026-09-01", "2026-12-01", null, T)).toBe(0);
    expect(effectiveMonths("2026-06-01", "2026-09-01", "2026-10-20", T)).toBe(0);
  });
  it("periodo precedente pieno", () => {
    expect(effectiveMonths("2026-06-01", "2026-09-01", "2026-01-05", T)).toBe(3);
  });
});

describe("usageStart", () => {
  it("ignora entrate e categorie fisse, conta le spese senza categoria", () => {
    const cats = new Map([["m", { id: "m", name: "Mutuo" }], ["s", { id: "s", name: "Spesa" }]]);
    const txs = [
      { type: "expense", category_id: "m", date: "2026-01-01", amount: 650 },
      { type: "income", date: "2026-02-01", amount: 2000 },
      { type: "expense", category_id: "s", date: "2026-06-01", amount: 100 },
      { type: "expense", date: "2026-05-15", amount: 10 },
    ];
    expect(usageStart(txs, cats)).toBe("2026-05-15");
    expect(usageStart([], cats)).toBe(null);
  });
});

describe("computeStats", () => {
  const categories = [
    { id: "s", name: "Spesa", color: "#16a34a", icon: "ShoppingBag" },
    { id: "m", name: "Mutuo" },
    { id: "r", name: "Ristoranti", color: "#ea580c", icon: "Utensils" },
  ];
  const e = (category_id, date, amount) => ({ id: `${category_id}-${date}-${amount}`, type: "expense", category_id, date, amount });
  const transactions = [
    e("m", "2026-01-01", 650),
    e("s", "2026-06-01", 100), e("s", "2026-07-10", 200), e("s", "2026-08-10", 300),
    e("s", "2026-09-05", 280), e("s", "2026-10-05", 280), e("s", "2026-11-05", 280),
    e("r", "2026-11-12", 140),
    e("m", "2026-09-01", 650), e("m", "2026-10-01", 650), e("m", "2026-11-01", 650),
    { id: "inc", type: "income", date: "2026-11-01", amount: 2000 },
    { id: "nocat", type: "expense", date: "2026-11-10", amount: 35 },
    e("deleted", "2026-11-11", 7),
  ];
  const res = computeStats({ transactions, categories, today: "2026-11-24", months: 3 });

  it("classifica, medie e quote", () => {
    expect(res.rows.map((r) => r.name)).toEqual(["Spesa", "Ristoranti", "Senza categoria"]);
    expect(res.rows[0].avg).toBeCloseTo(300);
    expect(res.rows[1].avg).toBeCloseTo(50);
    expect(res.rows[2]).toMatchObject({ categoryId: null, color: "#94a3b8" });
    expect(res.rows[2].avg).toBeCloseTo(42 / 2.8);
    expect(res.avg).toBeCloseTo(300 + 50 + 15);
    expect(res.rows[0].share).toBeCloseTo(300 / 365);
  });
  it("confronto col periodo precedente", () => {
    expect(res.prevAvg).toBeCloseTo(200);
    expect(res.rows[0].delta).toBeCloseTo(0.5);
    expect(res.rows[1].delta).toBe(null);
  });
  it("spese fisse escluse", () => {
    expect(res.fixedAvg).toBeCloseTo(1950 / 2.8);
    expect(res.fixedNames).toEqual(["Mutuo"]);
  });
  it("mese per mese con i buchi a zero, e le spese più grosse", () => {
    expect(res.rows[1].monthly).toEqual([
      { key: "2026-09", total: 0 }, { key: "2026-10", total: 0 }, { key: "2026-11", total: 140 },
    ]);
    expect(res.rows[0].top.map((t) => t.amount)).toEqual([280, 280, 280]);
  });
  it("senza movimenti", () => {
    expect(computeStats({ transactions: [], categories, today: "2026-11-24", months: 3 }))
      .toEqual({ avg: 0, prevAvg: null, fixedAvg: 0, fixedNames: [], rows: [] });
  });
});
```

Nota sui numeri: l'inizio d'uso è `2026-06-01` (la spesa Mutuo di gennaio non conta), quindi il periodo corrente vale 2,8 mesi e il precedente 3; "Senza categoria" somma 35 + 7 (categoria eliminata) = 42.

- [ ] **Step 2: Lancia i test e verifica che falliscano**

Run: `npm test -- src/lib/stats.test.js`
Expected: FAIL (modulo `./stats` non trovato).

- [ ] **Step 3: Implementa `src/lib/stats.js`** con le firme dell'Interfaces block. Per le date usa aritmetica su anno/mese/giorno (o `new Date(y, m, d)` + `toLocalDateString`), mai `toISOString()`. Giorni del mese: `new Date(y, m, 0).getDate()`.

- [ ] **Step 4: Lancia i test e verifica che passino**

Run: `npm test`
Expected: PASS, tutti i test (30 esistenti + i nuovi).

- [ ] **Step 5: Commit** (dopo l'ok dell'utente)

```bash
git add src/lib/stats.js src/lib/stats.test.js
git commit -m "Add spending statistics calculations"
```

---

### Task 2: Flag "Spesa fissa" sulle categorie

**Files:**
- Modify: `src/components/categories/categorydialog.jsx` (stato del form ~righe 52-64, `handleSave` ~righe 67-95, JSX del form)
- Modify: `src/pages/categories.jsx` (riga dell'elenco ~righe 109-130)

**Interfaces:**
- Consumes: `isFixedCategory(category)` da Task 1.
- Produces: `Category.fixed: boolean` salvato solo quando l'utente salva il dialog di una categoria di tipo spesa.

- [ ] **Step 1: Dialog.** Nuovo stato `fixed`, inizializzato a `isFixedCategory(category ?? { name })` all'apertura; per una categoria nuova si ricalcola dal nome mentre l'utente scrive, finché non tocca l'interruttore. Visibile solo con `type === "expense"`. Controllo: riga con etichetta **"Spesa fissa"** e testo sotto **"Le spese fisse non compaiono nella classifica delle statistiche"**, interruttore accessibile (`role="switch"`, `aria-checked`), stile coerente col selettore "Ogni mese / Solo questo mese" della pagina Budget. In `handleSave` aggiungi `fixed` a `update`/`create` solo per le categorie di spesa.
- [ ] **Step 2: Elenco.** Nelle categorie di spesa con `isFixedCategory(c)` mostra accanto al nome l'etichetta piccola **"fissa"** (stesso stile della chip "solo <mese>" di `budgetrow.jsx`, in grigio: `bg-muted text-muted-foreground`).
- [ ] **Step 3: Verifica.** `npm run build`, `npm run lint`, `npm test` puliti. Nel browser (`npm run dev`): una categoria "Mutuo" mostra "fissa"; aprendola l'interruttore è acceso; spegnendolo e salvando l'etichetta sparisce; una categoria di entrata non mostra l'interruttore.
- [ ] **Step 4: Commit** (dopo l'ok dell'utente): `Add fixed-expense flag to categories`.

---

### Task 3: Pagina Statistiche, accessi e documentazione

**Files:**
- Create: `src/pages/stats.jsx`
- Create: `src/components/stats/statsrow.jsx` (riga espandibile con barra, grafico e spese più grosse)
- Modify: `src/App.jsx` (route `/stats`, con `React.lazy` + `Suspense` con lo spinner già usato nelle pagine)
- Modify: `src/pages/more.jsx` (prima voce di `items`)
- Modify: `src/pages/dashboard.jsx` (~righe 257-269, sotto `CategoryPieChart`)
- Modify: `CLAUDE.md` (Stato: punto 5 della roadmap fatto; menzione di `stats.js` e del flag `fixed`; pagina `stats` nell'elenco pagine)

**Interfaces:**
- Consumes: `periodRange`, `computeStats` da Task 1; `isFixedCategory` indirettamente; `AddTransactionDialog` (`open`, `onOpenChange`, `categories`, `transaction`) come in `transactions.jsx`; `CategoryIcon` da `@/components/categoryicon`; `formatCurrency`, `monthLabel` da `@/lib/format`; `todayLocal` da `@/lib/date`.

- [ ] **Step 1: Pagina `stats.jsx`.** Layout e spazi come `budgets.jsx` (`max-w-md mx-auto px-4`). Dall'alto:
  - titolo **"Statistiche"**;
  - selettore a segmenti **"3 mesi" · "6 mesi" · "12 mesi"**, predefinito 3, ricordato in localStorage chiave `app_budget_stats_period_v1` (lettura/scrittura in try/catch);
  - riepilogo (stile del riquadro "Ti restano" di Budget): **"Spendi in media, spese fisse escluse"**, importo grande `formatCurrency(avg)` + **"al mese"**; sotto, se `prevAvg` non è null e > 0: **"+8% rispetto ai 3 mesi prima"** (segno esplicito, percentuale arrotondata, numero di mesi del periodo);
  - titoletto **"Dove spendi di più"** e le righe `StatsRow`, una sola aperta alla volta;
  - riga finale tratteggiata: **"Spese fisse escluse: X al mese"** + elenco `fixedNames` separato da virgole + link **"Gestisci"** a `/categories`; nascosta se `fixedAvg` è 0;
  - stato vuoto se `rows` è vuoto: **"Nessuna spesa nel periodo"** + **"Aggiungi i tuoi movimenti per vedere dove spendi di più."**
  - caricamento: `Transaction.filter({ type: "expense", date: { $gte: prevStart, $lt: end } })` e `Category.filter({})` in parallelo, contatore di sequenza contro risposte vecchie (come `budgets.jsx`), ricarica su `expense-added`. Per `usageStart` serve la prima spesa in assoluto: carica anche `Transaction.filter({ type: "expense" }, { sort: "date" })` oppure passa tutte le spese a `computeStats` — scelta del builder, purché `computeStats` riceva almeno tutte le spese fino a `end`.
- [ ] **Step 2: `statsrow.jsx`.** Riga chiusa: icona/colore categoria, nome, `formatCurrency(avg)` + " /mese", barra proporzionale alla prima riga, `share` in % arrotondata, freccia **"↑ 50%"** (rosso) / **"↓ 20%"** (verde) solo se `delta !== null && Math.abs(delta) >= 0.1`. Riga aperta: barre mese per mese (recharts `BarChart` alto ~110px, etichette `monthLabel`, colore categoria, tooltip `formatCurrency`), poi **"Le spese più grosse del periodo"** con data (`formatDayMonth`), `merchant_name || description || "Movimento"`, importo; toccando una spesa si apre `AddTransactionDialog` in modifica.
- [ ] **Step 3: Accessi.** In `more.jsx` prima voce `{ to: '/stats', icon: BarChart3, label: 'Statistiche', desc: 'Dove spendi di più' }`. In Home, sotto la torta nel riquadro "Spese per categoria", link **"Vedi statistiche ›"** (`Link` a `/stats`, testo piccolo `text-primary`).
- [ ] **Step 4: CLAUDE.md** aggiornato come da Files.
- [ ] **Step 5: Verifica.** `npm run build` (il chunk della pagina statistiche è separato), `npm run lint`, `npm test` puliti. Nel browser a 375×812 con dati di prova: classifica ordinata, Mutuo fuori classifica e nella riga in fondo, cambio periodo ricordato al ricaricamento, riga espansa con grafico e spese, modifica di una spesa che aggiorna la pagina, stato vuoto senza dati. Ripristinare i dati del browser dopo la prova.
- [ ] **Step 6: Commit** (dopo l'ok dell'utente): `Add statistics page with spending ranking`.
