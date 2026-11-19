
import React, { useState, useEffect } from "react";
import { localData } from "@/api/localDataClient";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import CategoryPieChart from "@/components/charts/categorypiechart";
import { formatCurrency, MONTH_NAMES } from "@/lib/format";
import TransactionRow from "@/components/transactions/transactionrow";
import AddTransactionDialog from "@/components/transactions/addtransactiondialog";
import { getMonthRange } from "@/lib/date";

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState(null);

  useEffect(() => {
    load(selectedMonth);

    const handler = () => load(selectedMonth);
    window.addEventListener("expense-added", handler);

    return () => window.removeEventListener("expense-added", handler);
  }, [selectedMonth]);

  async function load(monthKey) {
    setLoading(true);

    try {
      const [year, month] = monthKey.split("-").map(Number);
      const { start: monthStart, end: monthEnd } = getMonthRange(year, month);

      const [summary, catAgg, catRes, recentRes] = await Promise.all([
        localData.entities.Transaction.aggregate({
          query: {
            date: { $gte: monthStart, $lt: monthEnd },
          },
          groupBy: "type",
          sum: ["amount"],
        }),

        localData.entities.Transaction.aggregate({
          query: {
            type: "expense",
            date: { $gte: monthStart, $lt: monthEnd },
          },
          groupBy: "category_id",
          sum: ["amount"],
        }),

        localData.entities.Category.filter({}, { limit: 100 }),

        localData.entities.Transaction.filter(
          {
            date: { $gte: monthStart, $lt: monthEnd },
          },
          { sort: "-date", limit: 5 }
        ),
      ]);

      const income =
        summary.rows.find((row) => row.type === "income")?.sum_amount || 0;

      const expense =
        summary.rows.find((row) => row.type === "expense")?.sum_amount || 0;

      const categoryMap = {};

      catRes.items.forEach((category) => {
        categoryMap[category.id] = category;
      });

      const allCategories = catAgg.rows
        .map((row) => {
          const category = categoryMap[row.category_id];

          return {
            name: category?.name || "Senza categoria",
            value: row.sum_amount || 0,
            color: category?.color || "#94a3b8",
          };
        })
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value);

      // Mostra le prime 5 categorie del mese e raggruppa le altre.
      const topCategories = allCategories.slice(0, 5);
      const otherCategories = allCategories.slice(5);

      if (otherCategories.length > 0) {
        const otherTotal = otherCategories.reduce(
          (total, category) => total + category.value,
          0
        );

        topCategories.push({
          name: "Altro",
          value: otherTotal,
          color: "#94a3b8",
        });
      }

      setData({
        income,
        expense,
        balance: income - expense,
        breakdown: topCategories,
      });

      setRecent(recentRes.items);
      setCategories(catRes.items);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCategorize(tx, categoryId, categoryName) {
    try {
      await localData.entities.Transaction.update(tx.id, {
        category_id: categoryId,
        category_name: categoryName,
        is_categorized: true,
      });

      load(selectedMonth);
    } catch (error) {
      console.error("Error categorizing transaction:", error);
    }
  }

  async function handleDelete(tx) {
    try {
      await localData.entities.Transaction.delete(tx.id);
      load(selectedMonth);
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  }

  function changeMonth(offset) {
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(year, month - 1 + offset, 1);

    const nextMonthKey = `${nextDate.getFullYear()}-${String(
      nextDate.getMonth() + 1
    ).padStart(2, "0")}`;

    setSelectedMonth(nextMonthKey);
  }

  const [year, month] = selectedMonth.split("-").map(Number);
  const monthName = MONTH_NAMES[month - 1];
  const isCurrentMonth = selectedMonth === getCurrentMonthKey();

  const d = data || {
    income: 0,
    expense: 0,
    balance: 0,
    breakdown: [],
  };

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-md mx-auto space-y-5 px-3 sm:px-4 pt-2 pb-6">
      {/* Selettore del mese */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          aria-label="Mese precedente"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center min-w-0">
          <p className="text-lg font-semibold truncate">
            {monthName} {year}
          </p>

          {isCurrentMonth && (
            <p className="text-xs text-muted-foreground">Mese corrente</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          aria-label="Mese successivo"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Saldo mensile */}
      <div className="min-w-0 pt-1">
        <p className="text-sm text-muted-foreground">Saldo del mese</p>

        <h1 className="text-3xl font-bold tracking-tight mt-1 break-words">
          {formatCurrency(d.balance)}
        </h1>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-5">
          <div className="min-w-0 rounded-xl bg-emerald-500/10 p-3">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">Entrate</span>
            </div>

            <p className="text-base font-semibold mt-1 break-words">
              {formatCurrency(d.income)}
            </p>
          </div>

          <div className="min-w-0 rounded-xl bg-red-500/10 p-3">
            <div className="flex items-center gap-1.5 text-red-500">
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium">Spese</span>
            </div>

            <p className="text-base font-semibold mt-1 break-words">
              {formatCurrency(d.expense)}
            </p>
          </div>
        </div>
      </div>

      {/* Suddivisione delle spese */}
      <Card className="w-full min-w-0 p-3 sm:p-4 overflow-hidden">
        <div className="mb-2">
          <h3 className="font-semibold text-sm">Spese per categoria</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Distribuzione delle spese del mese
          </p>
        </div>

        <CategoryPieChart
          data={d.breakdown}
          total={d.expense}
        />
      </Card>

      {/* Ultimi 5 movimenti del mese */}
      <div className="w-full min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Attività del mese</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ultimi 5 movimenti
            </p>
          </div>

          <Link
            to="/transactions"
            className="text-xs text-primary flex items-center gap-0.5 shrink-0"
          >
            Vedi tutti <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <Card className="w-full min-w-0 p-2 overflow-hidden">
          {recent.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nessun movimento in questo mese
            </p>
          ) : (
            recent.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                categories={categories}
                onCategorize={handleCategorize}
                onDelete={handleDelete}
                onEdit={setEditingTransaction}
              />
            ))
          )}
        </Card>
      </div>

      <AddTransactionDialog
        open={!!editingTransaction}
        onOpenChange={(open) => {
          if (!open) setEditingTransaction(null);
        }}
        categories={categories}
        transaction={editingTransaction}
        onAdded={() => load(selectedMonth)}
      />
    </div>
  );
}
