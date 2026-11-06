import React, { useState, useEffect, useMemo } from "react";
import { localData } from "@/api/localDataClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TransactionRow from "@/components/transactions/transactionrow";
import { MONTH_NAMES } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function Transactions() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("expense-added", handler);
    return () => window.removeEventListener("expense-added", handler);
  }, [refresh, typeFilter, monthFilter]);

  async function load() {
    setLoading(true);
    try {
      const query = {};
      if (typeFilter !== "all") query.type = typeFilter;
      if (monthFilter !== "all") {
        const [y, m] = monthFilter.split("-").map(Number);
        const start = new Date(y, m - 1, 1).toISOString().split("T")[0];
        const end = new Date(y, m, 1).toISOString().split("T")[0];
        query.date = { $gte: start, $lt: end };
      }
      if (search.trim()) {
        query.description = { $regex: search.trim(), $options: "i" };
      }
      const [txRes, catRes] = await Promise.all([
        localData.entities.Transaction.filter(query, { sort: "-date", limit: 100 }),
        localData.entities.Category.filter({}, { limit: 100 }),
      ]);
      setTransactions(txRes.items);
      setCategories(catRes.items);
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
      setRefresh((r) => r + 1);
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(tx) {
    try {
      await localData.entities.Transaction.delete(tx.id);
      setRefresh((r) => r + 1);
      toast({ title: "Transaction deleted" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push({
        value: `${d.getFullYear()}-${d.getMonth() + 1}`,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return opts;
  }, []);

  return (
    <div className="space-y-3 p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold tracking-tight pt-2">Transactions</h1>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="pl-9"
          onKeyDown={(e) => e.key === "Enter" && setRefresh((r) => r + 1)}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex p-1 bg-muted rounded-lg">
          {["all", "expense", "income"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                typeFilter === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="p-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          transactions.map((tx) => (
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
  );
}