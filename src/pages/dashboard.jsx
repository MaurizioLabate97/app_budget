
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

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

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
      const monthIndex = month - 1;

      const monthStart = `${monthKey}-01`;
      const monthEnd = getLocalDateString(
        new Date(year, monthIndex + 1, 1)
      );

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
            name: category?.name || "Uncategorized",
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
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 pb-6 max-w-md mx-auto">
      {/* Selettore del mese */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-lg font-semibold">
            {monthName} {year}
          </p>
          {isCurrentMonth && (
            <p className="text-xs text-muted-foreground">Current month</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Saldo mensile */}
      <div className="pt-1">
        <p className="text-sm text-muted-foreground">Monthly balance</p>

        <h1 className="text-3xl font-bold tracking-tight mt-1">
          {formatCurrency(d.balance)}
        </h1>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl bg-emerald-500/10 p-3">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Income</span>
            </div>
            <p className="text-base font-semibold mt-1">
              {formatCurrency(d.income)}
            </p>
          </div>

          <div className="rounded-xl bg-red-500/10 p-3">
            <div className="flex items-center gap-1.5 text-red-500">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-medium">Expenses</span>
            </div>
            <p className="text-base font-semibold mt-1">
              {formatCurrency(d.expense)}
            </p>
          </div>
        </div>
      </div>

      {/* Suddivisione delle spese */}
      <Card className="p-4">
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

      {/* Ultime 5 transazioni del mese */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-sm">Attività del mese</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ultime 5 transazioni
            </p>
          </div>

          <Link
            to="/transactions"
            className="text-xs text-primary flex items-center gap-0.5"
          >
            Vedi tutte <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <Card className="p-2">
          {recent.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nessuna transazione in questo mese
            </p>
          ) : (
            recent.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                categories={categories}
                onCategorize={handleCategorize}
                onDelete={handleDelete}
              />
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
