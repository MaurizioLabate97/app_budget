import React, { useState, useEffect, useRef } from "react";
import { BellRing, Check, SkipForward } from "lucide-react";

import { localData } from "@/api/localDataClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDayMonth } from "@/lib/format";
import { todayLocal } from "@/lib/date";
import { getDueOccurrences, periodKey } from "@/lib/recurring";

const keyOf = (o) => `${o.recurring.id}:${o.periodKey}`;

/**
 * Riquadro "Da confermare": scadenze delle spese ricorrenti arrivate a oggi
 * e non ancora confermate o saltate. Non mostra nulla se non ce ne sono.
 */
export default function DueOccurrences() {
  const { toast } = useToast();
  const [due, setDue] = useState([]);
  const [busy, setBusy] = useState(() => new Set());
  // Guardia sincrona contro il doppio tocco (lo stato React si aggiorna dopo).
  const inFlight = useRef(new Set());
  // Le azioni girano una alla volta, così ognuna legge i dati già aggiornati.
  const queue = useRef(Promise.resolve());
  // Ignora le risposte di caricamenti superati da uno più recente.
  const loadSeq = useRef(0);

  useEffect(() => {
    load();
    const handler = () => load();
    // Se l'app resta aperta oltre la mezzanotte, le scadenze del nuovo giorno
    // compaiono quando torna in primo piano.
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener("expense-added", handler);
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("expense-added", handler);
      window.removeEventListener("focus", handler);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function load() {
    const seq = ++loadSeq.current;
    try {
      const [rec, tx] = await Promise.all([
        localData.entities.RecurringTransaction.filter({}),
        localData.entities.Transaction.filter({ source: "recurring" }),
      ]);
      if (seq !== loadSeq.current) return;
      setDue(
        getDueOccurrences(rec.items, tx.items, todayLocal()).filter(
          (o) => !inFlight.current.has(keyOf(o))
        )
      );
    } catch (e) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }

  function run(occurrence, action) {
    const key = keyOf(occurrence);
    if (inFlight.current.has(key)) return;

    inFlight.current.add(key);
    setBusy(new Set(inFlight.current));

    queue.current = queue.current.then(async () => {
      try {
        await action();
        // Toglie subito la riga, senza aspettare il ricaricamento.
        setDue((list) => list.filter((o) => keyOf(o) !== key));
      } catch (e) {
        toast({ title: "Errore", description: e.message, variant: "destructive" });
      } finally {
        inFlight.current.delete(key);
        setBusy(new Set(inFlight.current));
      }
    });
  }

  function confirm(o) {
    const r = o.recurring;
    return run(o, async () => {
      // Difesa contro i doppioni: il periodo potrebbe essere già stato confermato.
      const { items: existing } = await localData.entities.Transaction.filter({
        recurring_id: r.id,
      });
      const alreadyDone = existing.some(
        (t) => t.occurrence_date && periodKey(r.frequency, t.occurrence_date) === o.periodKey
      );
      if (alreadyDone) return;

      await localData.entities.Transaction.create({
        type: "expense",
        amount: r.amount,
        date: o.date,
        occurrence_date: o.date,
        recurring_id: r.id,
        source: "recurring",
        description: r.description,
        merchant_name: r.merchant_name || "",
        category_id: r.category_id,
        category_name: r.category_name,
        is_categorized: !!r.category_id,
      });
      toast({ title: "Spesa registrata" });
    });
  }

  function skip(o) {
    const r = o.recurring;
    return run(o, async () => {
      // Rilegge il record: un altro "Salta" potrebbe averlo appena aggiornato.
      const { items } = await localData.entities.RecurringTransaction.filter({ id: r.id });
      const current = items[0] || r;
      await localData.entities.RecurringTransaction.update(r.id, {
        skipped_periods: [...new Set([...(current.skipped_periods || []), o.periodKey])],
      });
      toast({ title: "Scadenza saltata" });
    });
  }

  if (due.length === 0) return null;

  const today = todayLocal();

  return (
    <Card className="p-4 space-y-3 border-amber-500/40 bg-amber-500/5">
      <div className="flex items-center gap-2">
        <BellRing className="w-4 h-4 text-amber-600" />
        <h2 className="font-semibold text-sm">Da confermare</h2>
      </div>

      <ul className="space-y-2">
        {due.map((o) => {
          const disabled = busy.has(keyOf(o));
          const when =
            o.date === today ? "in scadenza oggi" : `scaduta il ${formatDayMonth(o.date, false)}`;

          return (
            <li key={keyOf(o)} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {o.recurring.description} · {formatCurrency(o.recurring.amount)}
                </p>
                <p className={"text-xs " + (o.date === today ? "text-muted-foreground" : "text-amber-700")}>
                  {when}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-muted-foreground"
                disabled={disabled}
                onClick={() => skip(o)}
              >
                <SkipForward className="w-4 h-4 mr-1" /> Salta
              </Button>
              <Button size="sm" className="h-8 px-2" disabled={disabled} onClick={() => confirm(o)}>
                <Check className="w-4 h-4 mr-1" /> Conferma
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
