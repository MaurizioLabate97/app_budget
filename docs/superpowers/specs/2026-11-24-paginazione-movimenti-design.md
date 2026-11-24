# Paginazione dei Movimenti — design breve

**Perché:** la pagina Movimenti mostrava al massimo 100 movimenti; oltre non si poteva andare.

**Obiettivo:** vedere tutto lo storico scorrendo, senza perdere la posizione quando si modifica un movimento.
**Non obiettivi:** ricerca sull'esercente (roadmap 6), riga meno affollata (roadmap 7), modifiche al data layer.

## Approcci
- **Scroll infinito a blocchi di 50 (scelto dall'utente):** quando la fine della lista entra in vista si carica il blocco successivo. Naturale su telefono.
- Pulsante "Mostra altri": più semplice ma più scomodo su telefono.
- Paginazione a pagine numerate: scartata, poco adatta al mobile.

## Design
- `Transaction.filter` supporta già `offset`/`limit` e restituisce `total`: nessuna modifica al data layer.
- Primo caricamento e ogni cambio di filtro o ricerca: primi 50 movimenti (ordinati per data decrescente).
- Sentinella in fondo alla lista osservata con `IntersectionObserver` (margine 300px): carica i 50 successivi, con spinner piccolo.
- Dopo una scrittura (evento `expense-added`: modifica, eliminazione, categorizzazione, nuovo movimento) si ricarica lo stesso numero di movimenti già mostrati, così la lista non torna in cima.
- Risposte vecchie scartate con un contatore di sequenza; i blocchi aggiunti sono deduplicati per `id`.
- Sopra la lista: "N movimenti" (singolare "1 movimento").
- La ricerca si applica con Invio come prima; svuotare il campo la toglie subito.
- Categorie caricate senza il limite di 100.
