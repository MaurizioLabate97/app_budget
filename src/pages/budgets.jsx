import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { localData } from "@/api/localDataClient";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import BudgetRow from "@/components/budget/budgetrow";
import NewBudgetSheet from "@/components/budget/newbudgetsheet";
import { formatCurrency, MONTH_NAMES } from "@/lib/format";
import { getMonthRange } from "@/lib/date";
import { ensureMonthBudgets } from "@/lib/budgetActions";
import { filterKey } from "@/lib/queryKeys";
import { useEntityAggregate, useEntityFilter } from "@/hooks/useLocalData";

const SAVE_DELAY = 600;
const MAX_MONTHS_BACK = 11;

export default function Budgets() {
  const { toast } = useToast();
  const now = new Date();
  const currentIndex = now.getFullYear() * 12 + now.getMonth();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const timers = useRef({});
  const queryClient = useQueryClient();

  const viewIndex = year * 12 + (month - 1);
  const monthName = MONTH_NAMES[month - 1];
  const isCurrent = viewIndex === currentIndex;

  const budgetsKey = filterKey("Budget", { month, year });
  const budgetsQuery = useQuery({
    queryKey: budgetsKey,
    queryFn: async () => {
      // I mesi futuri non si riempiono: il riporto vale per il mese corrente e quelli passati.
      if (viewIndex <= currentIndex) await ensureMonthBudgets(year, month);
      return localData.entities.Budget.filter({ month, year });
    },
  });
  const categoriesQuery = useEntityFilter("Category", { type: "expense" });
  const { start, end } = getMonthRange(year, month);
  const spentQuery = useEntityAggregate("Transaction", {
    query: { type: "expense", date: { $gte: start, $lt: end }, is_categorized: true },
    groupBy: "category_id",
    sum: ["amount"],
  });

  const budgets = budgetsQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.items ?? [];
  const spent = Object.fromEntries(
    (spentQuery.data?.rows ?? []).map((r) => [r.category_id, r.sum_amount || 0])
  );
  const loading = budgetsQuery.isPending || categoriesQuery.isPending || spentQuery.isPending;

  /** Aggiorna subito una voce nella cache, senza aspettare il ricaricamento. */
  function patchBudget(id, patch) {
    queryClient.setQueryData(budgetsKey, (old) =>
      old && { ...old, items: old.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }
    );
  }

  // Salva le modifiche in sospeso quando si lascia la pagina o l'app va in background.
  useEffect(() => {
    const pending = timers.current;
    const flushAll = () => Object.values(pending).forEach((t) => t.flush());
    const onHide = () => document.visibilityState === "hidden" && flushAll();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, []);

  function changeMonth(delta) {
    const next = viewIndex + delta;
    if (next > currentIndex || next < currentIndex - MAX_MONTHS_BACK) return;
    Object.values(timers.current).forEach((t) => t.flush());
    setOpenId(null);
    setYear(Math.floor(next / 12));
    setMonth((next % 12) + 1);
  }

  function amountOf(b) {
    return drafts[b.id] ?? b.amount_limit;
  }

  function setAmount(budget, value) {
    setDrafts((d) => ({ ...d, [budget.id]: value }));

    const save = async () => {
      delete timers.current[budget.id];
      try {
        const updated = await localData.entities.Budget.update(budget.id, { amount_limit: value });
        // Aggiorna subito la riga, così togliendo il draft non ricompare il valore vecchio.
        patchBudget(budget.id, { ...updated, amount_limit: value });
      } catch (e) {
        toast({ title: "Errore", description: e.message, variant: "destructive" });
      } finally {
        setDrafts((d) => {
          if (d[budget.id] !== value) return d;
          const rest = { ...d };
          delete rest[budget.id];
          return rest;
        });
      }
    };

    clearTimeout(timers.current[budget.id]?.id);
    timers.current[budget.id] = {
      id: setTimeout(save, SAVE_DELAY),
      flush: () => {
        clearTimeout(timers.current[budget.id]?.id);
        save();
      },
    };
  }

  async function setRecurring(budget, recurring) {
    const previous = budget.recurring;
    patchBudget(budget.id, { recurring });
    try {
      await localData.entities.Budget.update(budget.id, { recurring });
      toast({
        title: recurring ? "Si ripeterà ogni mese" : "Non verrà riportata ai mesi successivi",
      });
    } catch (e) {
      patchBudget(budget.id, { recurring: previous });
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(budget) {
    try {
      clearTimeout(timers.current[budget.id]?.id);
      delete timers.current[budget.id];
      await localData.entities.Budget.delete(budget.id);
      setOpenId(null);
      toast({ title: "Voce eliminata" });
    } catch (e) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }

  const catName = (b) => categories.find((c) => c.id === b.category_id)?.name || b.category_name || "";
  // Ordine alfabetico: stabile anche mentre si regola un importo.
  const sorted = [...budgets].sort((a, b) => catName(a).localeCompare(catName(b), "it-IT"));
  const totalLimit = budgets.reduce((s, b) => s + amountOf(b), 0);
  const totalSpent = budgets.reduce((s, b) => s + (spent[b.category_id] || 0), 0);
  const remaining = totalLimit - totalSpent;
  const usedCategories = new Set(budgets.map((b) => b.category_id));
  const suggestions = categories.filter((c) => !usedCategories.has(c.id)).map((c) => c.name);

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            disabled={viewIndex <= currentIndex - MAX_MONTHS_BACK}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted disabled:opacity-30"
            aria-label="Mese precedente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="min-w-[112px] text-center font-medium text-foreground">
            {monthName} {year}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            disabled={isCurrent}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted disabled:opacity-30"
            aria-label="Mese successivo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {budgets.length > 0 && (
            <div className="rounded-2xl bg-muted/60 px-4 py-3.5">
              <p className="text-sm text-muted-foreground">
                {remaining >= 0 ? "Ti restano" : "Hai sforato"} a {monthName.toLowerCase()}
              </p>
              <p className={"text-3xl font-bold tracking-tight tabular-nums " + (remaining < 0 ? "text-red-600" : "")}>
                {formatCurrency(Math.abs(remaining))}
              </p>
              <div className="h-1.5 rounded-full bg-background/80 overflow-hidden mt-2">
                <div
                  className={"h-full rounded-full " + (remaining < 0 ? "bg-red-500" : "bg-primary")}
                  style={{ width: `${totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground tabular-nums mt-1.5">
                {formatCurrency(totalSpent)} spesi su {formatCurrency(totalLimit)}
              </p>
            </div>
          )}

          {budgets.length === 0 && (
            <div className="text-center py-6 space-y-1">
              <p className="font-medium">Nessun budget per {monthName.toLowerCase()}</p>
              <p className="text-sm text-muted-foreground">
                Aggiungi le voci su cui vuoi tenere un limite: dal mese prossimo si ripropongono da sole.
              </p>
            </div>
          )}

          <div>
            {sorted.map((b) => (
              <BudgetRow
                key={b.id}
                budget={b}
                category={categories.find((c) => c.id === b.category_id)}
                spent={spent[b.category_id] || 0}
                amount={amountOf(b)}
                open={openId === b.id}
                monthName={monthName}
                onToggle={() => setOpenId((id) => (id === b.id ? null : b.id))}
                onAmountChange={(v) => setAmount(b, v)}
                onRecurringChange={(r) => setRecurring(b, r)}
                onDelete={() => setToDelete(b)}
              />
            ))}

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-4 w-full rounded-2xl border-[1.5px] border-dashed border-border py-3.5 text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 active:bg-muted"
            >
              <Plus className="w-4 h-4" /> Nuova voce
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminare questa voce?"
        description={
          toDelete
            ? `"${catName(toDelete)}" verrà tolta da ${monthName.toLowerCase()} e non verrà più riproposta nei prossimi mesi. I movimenti non vengono toccati.`
            : ""
        }
        onConfirm={() => handleDelete(toDelete)}
      />

      <NewBudgetSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        year={year}
        month={month}
        monthName={monthName}
        suggestions={suggestions}
      />
    </div>
  );
}
