import React from "react";
import { formatCurrency } from "@/lib/format";
import { CategoryIcon } from "@/components/categoryicon";
import CategorySelect from "./categoryselect";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TransactionRow({ transaction, categories, onCategorize, onDelete }) {
  const isIncome = transaction.type === "income";
  const date = new Date(transaction.date).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const cat = categories.find((c) => c.id === transaction.category_id);
  const iconColor = cat?.color || (isIncome ? "#10b981" : "#94a3b8");
  return (
    <div className="flex items-center gap-2.5 py-2.5 px-1 border-b last:border-0">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconColor + "20" }}
      >
        <CategoryIcon name={cat?.icon || "Tag"} className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {transaction.merchant_name || transaction.description || "Transaction"}
        </p>
        <p className="text-xs text-muted-foreground">
          {date}
          {transaction.pending ? " · pending" : ""}
          {transaction.source === "bank" ? " · bank" : ""}
        </p>
      </div>
      <div className="shrink-0">
        <CategorySelect
          categories={categories}
          current={transaction.category_id}
          type={transaction.type}
          onCategorize={(id, name) => onCategorize(transaction, id, name)}
        />
      </div>
      <div
        className={cn(
          "font-semibold text-sm shrink-0 w-16 text-right",
          isIncome ? "text-emerald-600" : "text-foreground"
        )}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </div>
      <button
        onClick={() => onDelete(transaction)}
        className="text-muted-foreground hover:text-red-600 p-1 -mr-1 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}