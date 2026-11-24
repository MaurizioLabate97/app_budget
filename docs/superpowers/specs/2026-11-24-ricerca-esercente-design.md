# Ricerca anche sull'esercente — design breve

Data: 24/11/2026 · Roadmap fase 3, punto 6.

**Perché:** in Movimenti la ricerca guardava solo la descrizione, mentre nella riga si vede soprattutto l'esercente: cercando "esselunga" non si trovava niente.

**Obiettivi:** la ricerca trova il testo in **esercente** (`merchant_name`), **descrizione** e **nome della categoria** (`category_name`), senza distinzione di maiuscole; parte mentre si scrive.
**Non obiettivi:** ricerca che ignora gli accenti o fuzzy, ricerca per importo, ricerca in altre pagine.

## Approcci
- **`$or` nei filtri del data layer + query costruita da una funzione testata (scelto).** Lo scroll infinito e il conteggio restano gestiti da `Transaction.filter`.
- Filtro in pagina dopo il caricamento: scartato, rompe paginazione e conteggio.
- Ricerca "intelligente" (accenti, fuzzy): scartata, eccessiva per un'app personale.

## Design
- `matches` (oggi interna a `localDataClient.js`) diventa una funzione pura in `src/lib/query.js`, importata dal data layer, e supporta la chiave `$or: [subquery, ...]` (vera se almeno una subquery è vera).
- `buildSearchQuery(text)` in `src/lib/search.js`: testo vuoto → `{}`; altrimenti `{ $or: [...] }` su `merchant_name`, `description`, `category_name` con `$regex` del testo **escapato** (i caratteri speciali valgono come testo) e `$options: "i"`.
- Movimenti: ricerca applicata 500 ms dopo l'ultima battuta (e subito con Invio o svuotando il campo); segnaposto "Cerca esercente, descrizione o categoria".
- Backup zip fatto prima di toccare il data layer.
