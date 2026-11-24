import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { localData } from "@/api/localDataClient";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import TransactionRow from "@/components/transactions/transactionrow";
import AddTransactionDialog from "@/components/transactions/addtransactiondialog";
import { MONTH_NAMES } from "@/lib/format";
import { getMonthRange } from "@/lib/date";
import { cn } from "@/lib/utils";
import { buildSearchQuery } from "@/lib/search";
import { filterKey } from "@/lib/queryKeys";
import { useEntityFilter } from "@/hooks/useLocalData";

const PAGE_SIZE = 50;
const SEARCH_DELAY = 500;

export default function Transactions() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const sentinel = useRef(null);

  const query = useMemo(() => {
    const q = buildSearchQuery(appliedSearch);
    if (typeFilter !== "all") q.type = typeFilter;
    if (monthFilter !== "all") {
      const [y, m] = monthFilter.split("-").map(Number);
      const { start, end } = getMonthRange(y, m);
      q.date = { $gte: start, $lt: end };
    }
    return q;
  }, [typeFilter, monthFilter, appliedSearch]);

  const showError = useCallback(
    (e) => toast({ title: "Errore", description: e.message, variant: "destructive" }),
    [toast]
  );

  // Blocchi da 50. Dopo una scrittura React Query ricarica tutti i blocchi già
  // mostrati, quindi la lista non torna ai primi 50.
  const txQuery = useInfiniteQuery({
    queryKey: [...filterKey("Transaction", query, { sort: "-date" }), "pages"],
    queryFn: ({ pageParam }) =>
      localData.entities.Transaction.filter(query, {
        sort: "-date",
        offset: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, page) => n + page.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    // Cambiando filtro o ricerca resta visibile la lista di prima finché arriva la nuova.
    placeholderData: keepPreviousData,
  });
  const categoriesQuery = useEntityFilter("Category");

  const categories = categoriesQuery.data?.items ?? [];
  const pages = txQuery.data?.pages;
  const total = pages?.at(-1)?.total ?? 0;
  const loading = txQuery.isPending;
  const loadingMore = txQuery.isFetchingNextPage;

  // Tra un blocco e l'altro un movimento può spostarsi: si tiene la prima copia.
  const transactions = useMemo(() => {
    const seen = new Set();
    return (pages ?? [])
      .flatMap((page) => page.items)
      .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  }, [pages]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = txQuery;
  const loadMore = useCallback(() => {
    if (!isFetchingNextPage) fetchNextPage();
  }, [isFetchingNextPage, fetchNextPage]);

  // La ricerca parte da sola poco dopo l'ultima battuta.
  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [search]);

  const hasMore = !loading && !!hasNextPage;

  // Quando la fine della lista entra in vista carica il blocco successivo.
  // Si riaggancia a ogni blocco: se la fine è ancora visibile ne carica subito un altro.
  useEffect(() => {
    const el = sentinel.current;
    if (!hasMore || !el) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && loadMore(),
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore, transactions.length]);

  // Le scritture invalidano la cache: la lista si ricarica mantenendo la posizione.
  async function handleCategorize(tx, categoryId, categoryName) {
    try {
      await localData.entities.Transaction.update(tx.id, {
        category_id: categoryId,
        category_name: categoryName,
        is_categorized: true,
      });
    } catch (e) {
      showError(e);
    }
  }

  function handleEdit(tx) {
    setEditingTransaction(tx);
    setEditDialogOpen(true);
  }

  function handleDialogOpenChange(open) {
    setEditDialogOpen(open);

    if (!open) {
      setEditingTransaction(null);
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
      <h1 className="text-2xl font-bold tracking-tight pt-2">
        Movimenti
      </h1>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />

        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            // Svuotando il campo la ricerca si toglie subito.
            if (!e.target.value.trim()) setAppliedSearch("");
          }}
          placeholder="Cerca esercente, descrizione o categoria"
          className="pl-9"
          onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(search.trim())}
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
                typeFilter === t
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {{ all: "Tutti", expense: "Spese", income: "Entrate" }[t]}
            </button>
          ))}
        </div>

        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Mese" />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">Tutti i mesi</SelectItem>

            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!loading && total > 0 && (
        <p className="text-xs text-muted-foreground px-1 tabular-nums">
          {total === 1 ? "1 movimento" : `${total.toLocaleString("it-IT")} movimenti`}
        </p>
      )}

      <Card className="p-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Nessun movimento trovato</p>
          </div>
        ) : (
          <>
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                categories={categories}
                onCategorize={handleCategorize}
                onEdit={handleEdit}
              />
            ))}

            {hasMore && (
              <div ref={sentinel} className="flex justify-center py-4" aria-hidden={!loadingMore}>
                {loadingMore && (
                  <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
                )}
              </div>
            )}
          </>
        )}
      </Card>

      <AddTransactionDialog
        open={editDialogOpen}
        onOpenChange={handleDialogOpenChange}
        categories={categories}
        transaction={editingTransaction}
      />
    </div>
  );
}
