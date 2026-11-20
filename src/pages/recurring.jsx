import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Pause, Play } from "lucide-react";

import { localData } from "@/api/localDataClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { CategoryIcon } from "@/components/categoryicon";
import ConfirmDialog from "@/components/ConfirmDialog";
import RecurringDialog from "@/components/recurring/recurringdialog";
import { formatCurrency, formatDayMonth } from "@/lib/format";
import { todayLocal } from "@/lib/date";
import { getDueOccurrences, nextOccurrence, periodsToSkipOnResume } from "@/lib/recurring";

const FREQUENCY_LABEL = { monthly: "Mensile", yearly: "Annuale" };

export default function Recurring() {
  const { toast } = useToast();
  const [recurrings, setRecurrings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [confirmed, setConfirmed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("expense-added", handler);
    return () => window.removeEventListener("expense-added", handler);
  }, []);

  async function load() {
    try {
      const [rec, cats, tx] = await Promise.all([
        localData.entities.RecurringTransaction.filter({}, { sort: "description" }),
        localData.entities.Category.filter({}, { sort: "name" }),
        localData.entities.Transaction.filter({ source: "recurring" }),
      ]);
      setRecurrings(rec.items);
      setCategories(cats.items);
      setConfirmed(tx.items);
    } catch (e) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openDialog(recurring = null) {
    setEditing(recurring);
    setDialogOpen(true);
  }

  async function toggleActive(r) {
    setBusyId(r.id);
    try {
      if (r.active === false) {
        // Riattivazione: i periodi della pausa non vanno proposti come scaduti.
        const { items: confirmed } = await localData.entities.Transaction.filter({
          recurring_id: r.id,
        });
        const toSkip = periodsToSkipOnResume(r, confirmed, todayLocal());
        await localData.entities.RecurringTransaction.update(r.id, {
          active: true,
          skipped_periods: [...new Set([...(r.skipped_periods || []), ...toSkip])],
        });
        toast({ title: "Spesa ricorrente riattivata" });
      } else {
        await localData.entities.RecurringTransaction.update(r.id, { active: false });
        toast({ title: "Spesa ricorrente sospesa" });
      }
    } catch (e) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(r) {
    try {
      await localData.entities.RecurringTransaction.delete(r.id);
      toast({ title: "Spesa ricorrente eliminata" });
    } catch (e) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }

  const today = todayLocal();

  return (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spese ricorrenti</h1>
          <p className="text-sm text-muted-foreground">Affitto, abbonamenti e altre spese fisse</p>
        </div>
        <Button onClick={() => openDialog()} className="gap-1.5">
          <Plus className="w-4 h-4" /> Aggiungi
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : recurrings.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nessuna spesa ricorrente. Aggiungi affitto e abbonamenti per ricevere un avviso alla
            scadenza.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => openDialog()}>
            Aggiungi la prima
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {recurrings.map((r) => {
            const cat = categories.find((c) => c.id === r.category_id);
            const paused = r.active === false;
            const next = nextOccurrence(r, today, confirmed);
            const pending = paused ? 0 : getDueOccurrences([r], confirmed, today).length;
            const status = paused
              ? "Sospesa"
              : pending
                ? pending === 1
                  ? "1 da confermare"
                  : `${pending} da confermare`
                : next
                ? `Prossima: ${formatDayMonth(next, next.slice(0, 4) !== today.slice(0, 4))}`
                : "Terminata";

            return (
              <Card key={r.id} className={"p-4 " + (paused ? "opacity-60" : "")}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    onClick={() => openDialog(r)}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (cat?.color || "#6366f1") + "20" }}
                    >
                      <CategoryIcon
                        name={cat?.icon || "Tag"}
                        className="w-4 h-4"
                        style={{ color: cat?.color || "#6366f1" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatCurrency(r.amount)} · {FREQUENCY_LABEL[r.frequency] || "Mensile"} ·{" "}
                        {status}
                      </p>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-60"
                    aria-label={paused ? "Riattiva" : "Sospendi"}
                    disabled={busyId === r.id}
                    onClick={() => toggleActive(r)}
                  >
                    {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-40"
                    aria-label="Modifica"
                    onClick={() => openDialog(r)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-40 text-muted-foreground hover:text-red-600"
                    aria-label="Elimina"
                    onClick={() => setToDelete(r)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminare questa spesa ricorrente?"
        description={
          toDelete
            ? `"${toDelete.description}" non verrà più proposta. I movimenti già registrati restano.`
            : ""
        }
        onConfirm={() => handleDelete(toDelete)}
      />

      <RecurringDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        recurring={editing}
        onSaved={load}
      />
    </div>
  );
}
