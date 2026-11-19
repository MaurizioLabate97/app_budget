
import React, { useState } from "react";

import { formatCurrency } from "@/lib/format";
import { CategoryIcon } from "@/components/categoryicon";
import CategorySelect from "./categoryselect";
import { Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function TransactionRow({
  transaction,
  categories,
  onCategorize,
  onDelete,
  onEdit,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isIncome = transaction.type === "income";

  // "YYYY-MM-DD" interpretata come data locale (new Date("YYYY-MM-DD") sarebbe UTC).
  const [y, m, d] = String(transaction.date || "").split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });

  const cat = categories.find((c) => c.id === transaction.category_id);
  const iconColor = cat?.color || (isIncome ? "#10b981" : "#94a3b8");

  return (
    <div className="flex items-center gap-2.5 py-2.5 px-1 border-b last:border-0">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconColor + "20" }}
      >
        <CategoryIcon
          name={cat?.icon || "Tag"}
          className="w-4 h-4"
          style={{ color: iconColor }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {transaction.merchant_name || transaction.description || "Movimento"}
        </p>

        <p className="text-xs text-muted-foreground">
          {date}
          {transaction.pending ? " · in sospeso" : ""}
          {transaction.source === "bank" ? " · banca" : ""}
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

      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          title="Modifica movimento"
          aria-label="Modifica movimento"
          className="text-muted-foreground hover:text-primary p-1 shrink-0"
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        title="Elimina movimento"
        aria-label="Elimina movimento"
        className="text-muted-foreground hover:text-red-600 p-1 -mr-1 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminare il movimento?"
        description={`${transaction.merchant_name || transaction.description || "Movimento"} · ${isIncome ? "+" : "-"}${formatCurrency(transaction.amount)} · ${date}`}
        onConfirm={() => onDelete(transaction)}
      />
    </div>
  );
}
