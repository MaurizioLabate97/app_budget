# Statistiche: dove spendo di più — design

Data: 24/11/2026 · Roadmap fase 3, punto 5.

## Perché

L'utente vuole capire **dove spende di più**, per poi ragionare su come mettere da parte qualcosa.
Le spese fisse (mutuo, bollette) non gli interessano: sono pressoché fisse e lì non c'è niente da decidere.
Oggi la Home mostra solo un mese alla volta (torta "Spese per categoria", prime 5 + "Altro"): un solo mese è troppo variabile per decidere cosa tagliare.

## Obiettivi

- Classifica delle categorie di spesa **non fisse**, su un periodo di più mesi, con il peso di ognuna.
- Capire per ogni categoria se la spesa è costante o fatta di poche spese grosse, e se sta salendo o scendendo.
- Poter dire all'app quali categorie sono fisse.

## Non obiettivi

- Entrate, saldo, risparmio mese per mese: arriveranno dopo, quando l'utente ragionerà su come mettere da parte (i grafici `monthlytrendchart.jsx` e `balance.jsx` restano per allora).
- Modificare la Home oltre a un link.
- Obiettivi di risparmio, suggerimenti automatici, notifiche.
- Statistiche per esercente (dipende dalla roadmap 6).

## Anti-obiettivi

- Una classifica dominata da mutuo e bollette: sarebbe inutile.
- Numeri che ingannano: medie diluite da mesi in cui l'app non era ancora usata, o un mese a metà trattato come un mese intero.
- Una pagina lunga e affollata su telefono: deve stare comoda su iPhone, con gli spazi della pagina Budget.

## Vincoli

- Solo locale, nessun backend. Data layer invariato nell'API (`localData.entities.X.filter/aggregate`).
- Date come stringhe locali `YYYY-MM-DD` con gli helper di `src/lib/date.js`, mai `toISOString()` per ricavare un giorno.
- UI in italiano, importi con `formatCurrency` (it-IT).
- Nessuna migrazione dei dati: i record esistenti devono funzionare senza modifiche.
- iOS Safari ≥ 15.4 (già richiesto dal progetto).

## Approcci considerati

- **A. Pagina "Statistiche" + flag "Spesa fissa" sulle categorie (scelto dall'utente).** Pagina dedicata con lo spazio che serve; il flag è esplicito e l'utente lo controlla. Costo: una pagina e un campo in più.
- B. Tutto in Home sotto la torta. Scartato: la Home è legata al mese selezionato e diventerebbe lunghissima.
- C. Riconoscimento automatico delle spese fisse (importo costante, origine ricorrente). Scartato: le bollette variano e la spesa al supermercato è costante, sbaglierebbe proprio dove conta.

## Design

### Spese fisse

- Nuovo campo facoltativo `Category.fixed` (booleano).
- Se il campo **manca** (categorie esistenti o nuove mai toccate), vale la regola sul nome: è fissa se il nome contiene, senza distinzione di maiuscole, una di: `mutuo`, `affitto`, `bollett`, `luce`, `gas`, `acqua`, `condominio`. Per `gas` e `luce` usare i confini di parola come in `budgetActions.js` (es. "Gasolio" non è fissa). La regola sta in una funzione pura `isFixedCategory(category)` in `src/lib/stats.js`.
- Quando l'utente cambia l'interruttore si salva `fixed: true/false` esplicito, che da quel momento vince sulla regola.
- L'interruttore "Spesa fissa" sta nel dialog della categoria (`categorydialog.jsx`), solo per le categorie di tipo spesa, con una riga di spiegazione: "Le spese fisse non compaiono nella classifica delle statistiche".
- Nell'elenco delle Categorie, le fisse mostrano una piccola etichetta "fissa".

### Pagina Statistiche (`/stats`)

Raggiungibile da **Altro** (prima voce, icona `BarChart3`, descrizione "Dove spendi di più") e da un link "Vedi statistiche" sotto la torta in Home.

Dall'alto in basso:

1. **Titolo** "Statistiche" e selettore del periodo a segmenti: **3 mesi** (predefinito) · **6 mesi** · **12 mesi**. Il periodo scelto si ricorda in localStorage (comodità, con try/catch).
2. **Riepilogo**: "Spendi in media" + importo grande al mese per le spese non fisse nel periodo, e sotto una riga piccola con il confronto col periodo precedente (es. "+8% rispetto ai 3 mesi prima"), solo se il periodo precedente ha dati.
3. **Classifica**: una riga per categoria non fissa, ordinata per media mensile decrescente. Ogni riga: icona e colore della categoria, nome, media al mese, barra orizzontale proporzionale alla prima della classifica, quota sul totale delle spese variabili (es. "24%") e freccia ↑/↓ se la variazione rispetto al periodo precedente supera il 10% (nessuna freccia se il periodo precedente non ha spese in quella categoria). Le spese senza categoria compaiono come "Senza categoria" (grigio).
4. **Dettaglio**: toccando una riga si espande sotto (come le righe della pagina Budget, una sola aperta alla volta) e mostra:
   - un piccolo grafico a barre con il totale **mese per mese** della categoria nel periodo (recharts, già nel progetto);
   - le **5 spese più grosse** del periodo (data, descrizione/esercente, importo), toccabili per aprire la modifica come in Movimenti (`AddTransactionDialog`).
5. **Riga in fondo**: "Spese fisse escluse: 1.150 € al mese in media" con link "Gestisci" verso `/categories`.

Stato vuoto: se nel periodo non ci sono spese variabili, testo "Nessuna spesa nel periodo" e suggerimento di aggiungere movimenti.

La pagina si ricarica all'evento `expense-added` come le altre.

### Calcoli (`src/lib/stats.js`, funzioni pure, testate con Vitest)

- **Periodo di N mesi**: il mese corrente più gli N−1 mesi precedenti. Il periodo precedente è lo stesso numero di mesi subito prima.
- **Media mensile** = totale del periodo ÷ mesi effettivi, dove:
  - il periodo comincia al più presto dal **giorno di inizio uso**: la data della prima spesa in una categoria **non fissa** (o senza categoria). I mesi prima non contano (l'app non era usata: non devono diluire la media). *Scelta mia:* non si usa il primo movimento in assoluto perché una spesa fissa o una ricorrenza confermata con data vecchia (es. mutuo da gennaio), o un'entrata, allungherebbero il periodo e diluirebbero le medie. Se l'utente cambia il flag di una categoria l'inizio può spostarsi: va bene così;
  - il **mese di inizio uso** conta solo dal giorno della prima spesa (es. dal 20 ottobre vale 12/31); *scelta mia*, per lo stesso motivo;
  - il **mese corrente** conta in proporzione ai giorni passati (es. il 24 novembre vale 24/30), così un mese a metà non abbassa la media;
  - lo stesso giorno di inizio uso vale per la classifica, il riepilogo, la riga delle spese fisse (le fisse prima di quel giorno non contano) e il periodo precedente;
  - il periodo precedente si confronta solo se copre almeno un mese effettivo; con meno dati il confronto e le frecce non si mostrano (decisione presa dopo la revisione: con pochi giorni le percentuali sarebbero assurde);
  - se i mesi effettivi sono meno di 1 (es. app iniziata da pochi giorni), si usa 1 per non gonfiare la media.
- La stessa regola vale per il periodo precedente; se il periodo precedente cade tutto prima del primo movimento, il confronto non si mostra.
- Solo movimenti `type: "expense"`. Le entrate sono escluse.
- Le spese si leggono con `Transaction.filter` sul range di date (periodo + periodo precedente) e si raggruppano in JS: `aggregate` con `groupBy` e `dateBucket` insieme non funziona (il bucket sovrascrive la chiave), quindi non usarlo per il mese per mese per categoria.

## Lasciato al builder

- Struttura dei componenti (es. `src/pages/stats.jsx`, `src/components/stats/...`), nomi e stile, seguendo il layout della pagina Budget.
- Caricare la pagina con `React.lazy` per non appesantire il bundle (già sopra i 500 kB): consigliato, non obbligatorio.
- Formato esatto delle etichette dei mesi nel grafico (es. `monthLabel`).
- Eventuale aggiornamento di `getCategoryUsage` / backup: `fixed` è un campo normale del record, export/import lo portano già.
