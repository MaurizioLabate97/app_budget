import React, { useState, useEffect } from "react";
import { localData } from "@/api/localDataClient";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import CategoryPieChart from "@/components/charts/categorypiechart";
import MonthlyTrendChart from "@/components/charts/monthlytrendchart";
import { formatCurrency, MONTH_NAMES } from "@/lib/format";
import TransactionRow from "@/components/transactions/transactionrow";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("expense-added", handler);
    return () => window.removeEventListener("expense-added", handler);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const monthEnd = new Date(year, month, 1).toISOString().split("T")[0];
      const sixMonthsAgo = new Date(year, month - 6, 1).toISOString().split("T")[0];

      const [summary, expTrend, incTrend, catAgg, catRes, recentRes] = await Promise.all([
        localData.entities.Transaction.aggregate({
          query: { date: { $gte: monthStart, $lt: monthEnd } },
          groupBy: "type",
          sum: ["amount"],
        }),
        localData.entities.Transaction.aggregate({
          query: { type: "expense", date: { $gte: sixMonthsAgo } },
          dateBucket: { field: "date", unit: "month" },
          sum: ["amount"],
        }),
        localData.entities.Transaction.aggregate({
          query: { type: "income", date: { $gte: sixMonthsAgo } },
          dateBucket: { field: "date", unit: "month" },
          sum: ["amount"],
        }),
        localData.entities.Transaction.aggregate({
          query: { type: "expense", date: { $gte: monthStart, $lt: monthEnd } },
          groupBy: "category_id",
          sum: ["amount"],
        }),
        localData.entities.Category.filter({}, { limit: 100 }),
        localData.entities.Transaction.filter({}, { sort: "-date", limit: 5 }),
      ]);

      const income = (summary.rows.find((r) => r.type === "income") || {}).sum_amount || 0;
      const expense = (summary.rows.find((r) => r.type === "expense") || {}).sum_amount || 0;

      const trendMap = {};
      [...expTrend.rows, ...incTrend.rows].forEach((r) => {
        const key = (r.date || "").substring(0, 7);
        if (!trendMap[key]) trendMap[key] = { month: key, income: 0, expense: 0 };
      });
      expTrend.rows.forEach((r) => {
        const k = (r.date || "").substring(0, 7);
        if (trendMap[k]) trendMap[k].expense = r.sum_amount || 0;
      });
      incTrend.rows.forEach((r) => {
        const k = (r.date || "").substring(0, 7);
        if (trendMap[k]) trendMap[k].income = r.sum_amount || 0;
      });
      const trend = Object.keys(trendMap).sort().map((k) => trendMap[k]);

      const catMap = {};
      catRes.items.forEach((c) => (catMap[c.id] = c));
      const breakdown = catAgg.rows
        .map((r) => {
          const cat = catMap[r.category_id];
          return {
            name: cat?.name || "Uncategorized",
            value: r.sum_amount || 0,
            color: cat?.color || "#94a3b8",
          };
        })
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

      setData({ income, expense, balance: income - expense, trend, breakdown });
      setRecent(recentRes.items);
      setCategories(catRes.items);
    } catch (e) {
      console.error(e);
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
      load();
    } catch (e) {}
  }

  async function handleDelete(tx) {
    try {
      await localData.entities.Transaction.delete(tx.id);
      load();
    } catch (e) {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const d = data || { income: 0, expense: 0, balance: 0, trend: [], breakdown: [] };
  const now = new Date();

  return (
    <div className="space-y-4 p-4 max-w-md mx-auto">
      <div className="pt-2">
        <p className="text-sm text-muted-foreground">
          {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{formatCurrency(d.balance)}</h1>
        <p className="text-xs text-muted-foreground">Net balance this month</p>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">{formatCurrency(d.income)}</span>
            <span className="text-xs text-muted-foreground">in</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium">{formatCurrency(d.expense)}</span>
            <span className="text-xs text-muted-foreground">out</span>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-2">Spending by category</h3>
        <CategoryPieChart data={d.breakdown} />
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-sm mb-2">Income vs expenses</h3>
        <MonthlyTrendChart data={d.trend} />
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Recent activity</h3>
          <Link to="/transactions" className="text-xs text-primary flex items-center gap-0.5">
            See all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <Card className="p-2">
          {recent.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
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