# Budget ricorrenti — design

Data: 20/11/2026 · Stato: approvato in chat (layout B scelto sul prototipo)

## Perché

L'utente vuole fissare dei limiti di spesa per categoria che si ripetono ogni mese con lo stesso importo, ritoccarli al volo per il singolo mese e aggiungere voci occasionali (es. "Regali" a dicembre) senza ricrearle ogni volta.

## Obiettivi / non obiettivi

- **Obiettivi:**
  - popup al primo avvio per creare le prime voci, con Mutuo, Alcol e Spesa precompilate;
  - ogni mese le voci del mese precedente si ripropongono con gli stessi importi;
  - − / + con passo di 10 €, più l'importo modificabile a mano;
  - voci "Ogni mese" oppure "Solo questo mese";
  - niente doppioni per categoria e mese.
- **Non obiettivi:** budget per i mesi futuri, budget annuali, avvisi di sforamento, budget nella Dashboard.
- **Da evitare in ogni caso:**
  - voci "solo questo mese" che ricompaiono il mese dopo;
  - due voci della stessa categoria nello stesso mese;
  - una voce eliminata che ritorna.

## Approcci

- **Copia dal mese precedente all'apertura del mese (scelto).** Quando si apre un mese senza budget, si copiano le voci "Ogni mese" dell'ultimo mese che ne ha. Usa il modello esistente (un `Budget` per categoria, mese e anno), e i ritocchi del singolo mese passano da soli al mese dopo, come chiesto.
- **Modello di regola fissa più eccezioni mensili** (come le spese ricorrenti). Scartato: "il mese nuovo parte dall'importo del mese prima" costringerebbe a riscrivere la regola a ogni − / +.

## Design

### Dati

- `Budget`: `category_id`, `category_name`, `month`, `year`, `amount_limit`, più il campo nuovo **`recurring`**.
  - `recurring: true` (predefinito) significa "Ogni mese".
  - I budget esistenti senza il campo contano come ricorrenti.
- Nessuna tabella nuova.

### Riporto (`src/lib/budgets.js`, funzioni pure testate)

- `budgetsToCarry(allBudgets, year, month)`:
  - restituisce `[]` se il mese ha già almeno un budget;
  - altrimenti prende l'ultimo mese precedente che ha budget e ne restituisce le voci con `recurring !== false`, come dati da creare (`category_id`, `category_name`, `amount_limit`, `recurring: true`), una per categoria.
- La pagina Budget chiama il riporto **solo per il mese corrente o per uno passato** quando lo apre. I mesi saltati (un mese in cui l'app non è stata aperta) si riempiono quando li apri.
- Eliminare una voce in un mese vuol dire "non riproporla più da qui in avanti". Se elimini **tutte** le voci di un mese, alla riapertura vengono ricopiate: è un caso raro e accettato.

### UI — pagina Budget (layout B del prototipo)

- **Testata:** selettore del mese, come oggi.
- **Riepilogo:** "Ti restano a <mese>", la cifra rimasta, una barra e "X spesi su Y".
- **Elenco**, una riga per voce: icona della categoria, nome, etichetta "solo <mese>" se non ricorrente, "speso / limite" e la barra colorata (verde, ambra dall'80%, rosso oltre il 100%).
- **Tocco su una riga:** si apre sotto la riga **− [importo] +**.
  - L'importo è un campo modificabile a mano (`inputMode="decimal"`, `parseAmount`), salvato all'uscita dal campo o con Invio.
  - − / + vanno a passi di 10 € e non scendono sotto i 10 €.
  - Sotto ci sono il selettore "Ogni mese / Solo questo mese" e il link "Elimina", con `ConfirmDialog`: «Non verrà più riproposta dai prossimi mesi».
  - Si apre una riga alla volta.
- **Ultima riga tratteggiata "+ Nuova voce":** apre un pannello dal basso (`Drawer`) con:
  - nome, con suggerimenti dalle categorie di spesa senza budget questo mese;
  - importo;
  - "Ogni mese / Solo questo mese";
  - "Aggiungi".

  Se il nome corrisponde (senza distinguere maiuscole e minuscole) a una categoria di spesa esistente, si usa quella. Altrimenti si crea la categoria (tipo spesa, icona Tag). Se la categoria ha già un budget in quel mese compare l'errore «Hai già un budget per <nome> a <mese>».
- **Stato vuoto, se non c'è un mese precedente da cui copiare:** un invito a creare la prima voce.

### Popup del primo avvio

- Compare in `Layout` quando non esiste nessun `Budget` e il popup non è mai stato chiuso. Il flag sta in `localStorage` con try/catch, quindi un restore con budget non lo fa comparire.
- **Titolo:** "Imposta i tuoi budget mensili".
- **Righe precompilate:** Mutuo, Alcol, Spesa, con l'importo vuoto. Ogni riga si può togliere, e c'è "+ Aggiungi voce".
- **Salva budget:** crea le categorie mancanti e i budget del mese corrente (ricorrenti) per le righe con nome e importo validi.
- **"Più tardi"** chiude e non riapre il popup.

### Cosa si toglie

`src/components/budget/budgetdialog.jsx` viene sostituito dal pannello "Nuova voce" e dalla regolazione inline.

## Scelte lasciate a chi sviluppa (fatte da Claude)

- **Salvataggio di − / +:** aggiornamento ottimistico, poi salvataggio dopo 600 ms senza tocchi, per non scrivere a ogni tocco.
- **Nuova categoria creata da qui:** icona "Tag", colore preso a rotazione da una piccola palette.
- **Nessun budget per i mesi futuri:** il selettore resta com'è, mese corrente più gli 11 precedenti.
- **Backup** zip prima delle modifiche.
