# Riga del movimento meno affollata — design breve

Data: 24/11/2026 · Roadmap fase 3, punto 7. Prototipo: artifact "Riga del movimento" (variante A).

**Perché:** su iPhone la riga aveva 6 elementi (icona, nome + data, pulsante categoria, importo in colonna stretta, matita, cestino): nome troncato subito, importi grandi stretti, icone piccole e vicine. L'utente sulla riga **cambia spesso la categoria**, **modifica spesso**, **elimina raramente**.

**Obiettivi:** riga con icona, esercente, "categoria ▾ · data", importo; un tocco per modificare, un tocco per cambiare categoria.
**Non obiettivi:** swipe, selezione multipla, modifiche al dialog oltre al pulsante Elimina.

## Approcci
- **A. Tocca la riga per modificarla, categoria a portata di dito (scelto dall'utente dopo il prototipo).**
- B. Scorri la riga per Modifica/Elimina: provata nel prototipo, scartata dall'utente.
- C. Riga attuale con matita e cestino in un menu "⋯": scartata, resta affollata e modificare costa 2 tocchi.

## Design
- **Riga** (`transactionrow.jsx`, usata in Movimenti e Home):
  - icona della categoria, che è anche un pulsante per cambiare categoria;
  - prima riga: esercente (o descrizione, o "Movimento"), troncato con i puntini;
  - seconda riga: chip con il nome della categoria + "▾" (senza categoria: "Categorizza ▾" in ambra, come oggi), poi "· data"; restano le note "in sospeso" / "banca" se presenti;
  - a destra l'importo senza larghezza fissa (`+`/`-`, verde per le entrate), che non va mai a capo.
  - Niente matita né cestino.
- **Tocco sulla riga** (fuori da icona e chip) → apre la modifica (`AddTransactionDialog`). Tocco su icona o chip → menu delle categorie (il `CategorySelect` attuale, con il chip come trigger).
- **Elimina** si sposta nel dialog di modifica: pulsante "Elimina movimento" (testo rosso) visibile solo quando si modifica un movimento esistente, con `ConfirmDialog` ("Eliminare il movimento?" + esercente · importo · data). Dopo l'eliminazione il dialog si chiude e parte il toast "Movimento eliminato"; le pagine si ricaricano con `expense-added`.
- **Data:** resta il campo `type="date"` già presente (selettore di sistema su iPhone).
- **Accessibilità:** la riga resta raggiungibile da tastiera/VoiceOver (es. il nome come pulsante "Modifica <esercente>" che copre la riga, icona e chip sopra); nessun pulsante dentro un altro pulsante.

## Lasciato al builder
- Come rendere il trigger del `CategorySelect` come chip (prop o figlio personalizzato).
- Rimozione delle prop `onDelete` e degli handler ormai inutili in `transactions.jsx` e `dashboard.jsx`.
