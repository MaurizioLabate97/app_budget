import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { CategoryIcon } from "@/components/categoryicon";
import CategorySelect from "./categoryselect";
import { cn } from "@/lib/utils";

/**
 * Riga di un movimento: toccandola si apre la modifica,
 * toccando la categoria (o l'icona) si cambia la categoria al volo.
 */
export default function TransactionRow({ transaction, categories, onCategorize, onEdit }) {
  const [catOpen, setCatOpen] = useState(false);
  const isIncome = transaction.type === "income";
  const name = transaction.merchant_name || transaction.description || "Movimento";

  // "YYYY-MM-DD" interpretata come data locale (new Date("YYYY-MM-DD") sarebbe UTC).
  const [y, m, d] = String(transaction.date || "").split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });

  const cat = categories.find((c) => c.id === transaction.category_id);
  const iconColor = cat?.color || (isIncome ? "#10b981" : "#94a3b8");

  return (
    <div className="relative flex items-center gap-3 py-2.5 px-1 border-b last:border-0 active:bg-muted/50 rounded-md">
      <button
        type="button"
        onClick={() => setCatOpen(true)}
        aria-label={`Cambia categoria di ${name}`}
        className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconColor + "20" }}
      >
        <CategoryIcon name={cat?.icon || "Tag"} className="w-4 h-4" style={{ color: iconColor }} />
      </button>

      <div className="flex-1 min-w-0">
        {onEdit ? (
          // Il pulsante copre tutta la riga (after:inset-0): icona e categoria restano sopra.
          <button
            type="button"
            onClick={() => onEdit(transaction)}
            aria-label={`Modifica ${name}`}
            className="block w-full text-left font-medium text-[15px] truncate after:absolute after:inset-0 after:content-['']"
          >
            {name}
          </button>
        ) : (
          <p className="font-medium text-[15px] truncate">{name}</p>
        )}

        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
          <CategorySelect
            categories={categories}
            current={transaction.category_id}
            type={transaction.type}
            onCategorize={(id, catName) => onCategorize(transaction, id, catName)}
            open={catOpen}
            onOpenChange={setCatOpen}
            align="start"
          >
            <button
              type="button"
              className={cn(
                // L'area toccabile (before) è più grande del chip: su iPhone 20 px sono troppo pochi.
                "relative z-10 shrink-0 inline-flex items-center gap-0.5 max-w-[150px] rounded-full px-2 py-0.5 text-xs font-medium before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']",
                cat
                  ? "bg-muted text-foreground"
                  : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-300"
              )}
            >
              <span className="truncate">{cat ? cat.name : "Categorizza"}</span>
              <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
            </button>
          </CategorySelect>

          <span className="truncate">
            · {date}
            {transaction.pending ? " · in sospeso" : ""}
            {transaction.source === "bank" ? " · banca" : ""}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "font-semibold text-[15px] tabular-nums whitespace-nowrap shrink-0",
          isIncome ? "text-emerald-600" : "text-foreground"
        )}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </div>
    </div>
  );
}
