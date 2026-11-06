import React, { useState, useEffect } from "react";
import { localData } from "@/api/localDataClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { CategoryIcon } from "@/components/categoryicon";
import BudgetDialog from "@/components/budget/budgetdialog";
import { formatCurrency, MONTH_NAMES } from "@/lib/format";

export default function Budgets() {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [spent, setSpent] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("expense-added", handler);
    return () => window.removeEventListener("expense-added", handler);
  }, [month, year]);

  async function load() {
    setLoading(true);
    try {
      const start = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const end = new Date(year, month, 1).toISOString().split("T")[0];
      const [budRes, catRes, spentAgg] = await Promise.all([
        localData.entities.Budget.filter({ month, year }, { limit: 100 }),
        localData.entities.Category.filter({ type: "expense" }, { limit: 100 }),
        localData.entities.Transaction.aggregate({
          query: { type: "expense", date: { $gte: start, $lt: end }, is_categorized: true },
          groupBy: "category_id",
          sum: ["amount"],
        }),
      ]);
      setBudgets(budRes.items);
      setCategories(catRes.items);
      const s = {};
      spentAgg.rows.forEach((r) => (s[r.category_id] = r.sum_amount || 0));
      setSpent(s);
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(b) {
    try {
      await localData.entities.Budget.delete(b.id);
      load();
      toast({ title: "Budget removed" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push({
      value: `${d.getMonth() + 1}-${d.getFullYear()}`,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }

  return (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">Set monthly limits per category</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={`${month}-${year}`}
            onValueChange={(v) => {
              const [m, y] = v.split("-").map(Number);
              setMonth(m);
              setYear(y);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" /> New
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : budgets.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">No budgets set for this month yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Set your first budget
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const cat = categories.find((c) => c.id === b.category_id);
            const s = spent[b.category_id] || 0;
            const pct = b.amount_limit > 0 ? Math.min(100, (s / b.amount_limit) * 100) : 0;
            const over = s > b.amount_limit;
            const barColor = over ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
            return (
              <Card key={b.id} className="p-4 group">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: (cat?.color || "#6366f1") + "20" }}
                  >
                    <CategoryIcon
                      name={cat?.icon || "Tag"}
                      className="w-4 h-4"
                      style={{ color: cat?.color || "#6366f1" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{cat?.name || b.category_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(s)} of {formatCurrency(b.amount_limit)}
                    </p>
                  </div>
                  <span className={"text-sm font-semibold " + (over ? "text-red-600" : "text-muted-foreground")}>
                    {Math.round(pct)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-40"
                    onClick={() => {
                      setEditing(b);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-40 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(b)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={"h-full rounded-full transition-all " + barColor} style={{ width: `${pct}%` }} />
                </div>
                {over && (
                  <p className="text-xs text-red-600 mt-1.5">Over budget by {formatCurrency(s - b.amount_limit)}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        month={month}
        year={year}
        existing={editing}
        onSaved={load}
      />
    </div>
  );
}