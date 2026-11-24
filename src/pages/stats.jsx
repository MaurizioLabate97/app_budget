import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { localData } from "@/api/localDataClient";
import { useToast } from "@/components/ui/use-toast";
import StatsRow from "@/components/stats/statsrow";
import AddTransactionDialog from "@/components/transactions/addtransactiondialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { todayLocal } from "@/lib/date";
import { computeStats, periodRange } from "@/lib/stats";

const PERIODS = [3, 6, 12];
const PERIOD_KEY = "app_budget_stats_period_v1";

function readPeriod() {
  try {
    const v = Number(localStorage.getItem(PERIOD_KEY));
    return PERIODS.includes(v) ? v : 3;
  } catch {
    return 3;
  }
}

function savePeriod(v) {
  try {
    localStorage.setItem(PERIOD_KEY, String(v));
  } catch {
    // Solo una comodità: senza storage si riparte da 3 mesi.
  }
}

export default function Stats() {
  const { toast } = useToast();
  const [months, setMonths] = useState(readPeriod);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [today, setToday] = useState(todayLocal);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(undefined);
  const [editing, setEditing] = useState(null);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const now = todayLocal();
    // Servono tutte le spese fino alla fine del periodo: la prima decide il giorno di inizio uso.
    const { end } = periodRange(now, 12);
    try {
      const [txRes, catRes] = await Promise.all([
        localData.entities.Transaction.filter({ type: "expense", date: { $lt: end } }),
        localData.entities.Category.filter({}),
      ]);
      if (seq !== loadSeq.current) return;
      setTransactions(txRes.items);
      setCategories(catRes.items);
      setToday(now);
    } catch (e) {
      if (seq === loadSeq.current) toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    // Su iPhone l'app resta aperta in background: al ritorno ricarica, così il periodo segue la data di oggi.
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener("expense-added", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("expense-added", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const stats = useMemo(
    () => computeStats({ transactions, categories, today, months }),
    [transactions, categories, today, months]
  );

  function choosePeriod(v) {
    setMonths(v);
    setOpenId(undefined);
    savePeriod(v);
  }

  const change = stats.prevAvg > 0 ? Math.round(((stats.avg - stats.prevAvg) / stats.prevAvg) * 100) : null;
  const maxAvg = stats.rows[0]?.avg || 0;

  return (
    <div className="w-full max-w-md mx-auto px-4 pt-2 pb-6 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Statistiche</h1>

      <div className="flex bg-muted rounded-lg p-1" role="group" aria-label="Periodo">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={months === p}
            onClick={() => choosePeriod(p)}
            className={cn("flex-1 py-2 rounded-md text-sm font-medium", months === p && "bg-background shadow-sm")}
          >
            {p} mesi
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : stats.rows.length === 0 ? (
        <div className="text-center py-10 space-y-1">
          <p className="font-medium">Nessuna spesa nel periodo</p>
          <p className="text-sm text-muted-foreground">Aggiungi i tuoi movimenti per vedere dove spendi di più.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-muted/60 px-4 py-3.5">
            <p className="text-sm text-muted-foreground">Spendi in media, spese fisse escluse</p>
            <p className="text-3xl font-bold tracking-tight tabular-nums">
              {formatCurrency(stats.avg)}
              <span className="text-base font-medium text-muted-foreground"> al mese</span>
            </p>
            {change !== null && (
              <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                {change > 0 ? "+" : ""}
                {change}% rispetto ai {months} mesi prima
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-muted-foreground">Dove spendi di più</p>
            {stats.rows.map((row) => (
              <StatsRow
                key={row.categoryId ?? "none"}
                row={row}
                maxAvg={maxAvg}
                open={openId === row.categoryId}
                onToggle={() => setOpenId((id) => (id === row.categoryId ? undefined : row.categoryId))}
                onEditTransaction={setEditing}
              />
            ))}
          </div>
        </>
      )}

      {!loading && stats.fixedAvg > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
          <span className="min-w-0">
            Spese fisse escluse: <b className="tabular-nums text-foreground">{formatCurrency(stats.fixedAvg)}</b> al mese
            <span className="block text-xs truncate">{stats.fixedNames.join(", ")}</span>
          </span>
          <Link to="/categories" className="shrink-0 font-semibold text-primary">
            Gestisci ›
          </Link>
        </div>
      )}

      <AddTransactionDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        categories={categories}
        transaction={editing}
      />
    </div>
  );
}
