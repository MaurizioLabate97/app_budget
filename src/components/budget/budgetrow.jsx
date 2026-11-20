import React, { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { CategoryIcon } from "@/components/categoryicon";
import { cn } from "@/lib/utils";
import { formatCurrency, formatAmountInput, parseAmount } from "@/lib/format";
import { nextStep, BUDGET_STEP } from "@/lib/budgets";

function barColor(spent, limit) {
  const ratio = limit > 0 ? spent / limit : 0;
  if (ratio > 1) return "bg-red-500";
  if (ratio >= 0.8) return "bg-amber-500";
  return "bg-emerald-500";
}

/**
 * Riga di una voce di budget (layout "tocca e regola").
 * Toccandola si apre − [importo] +; l'importo si può anche scrivere a mano.
 */
export default function BudgetRow({
  budget,
  category,
  spent,
  amount,
  open,
  monthName,
  onToggle,
  onAmountChange,
  onRecurringChange,
  onDelete,
}) {
  const [text, setText] = useState(formatAmountInput(amount));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    // Mentre l'utente scrive non sovrascrivere il campo con valori arrivati dal salvataggio.
    if (focused.current) return;
    setText(formatAmountInput(amount));
    setInvalid(false);
  }, [amount, open]);

  const name = category?.name || budget.category_name || "Senza nome";
  const color = category?.color || "#6366f1";
  const pct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;
  const recurring = budget.recurring !== false;

  function commitText() {
    const value = parseAmount(text);
    if (!Number.isFinite(value) || value <= 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (value !== amount) onAmountChange(value);
  }

  return (
    <div className={cn("border-b border-border", open && "bg-muted/40 -mx-3 px-3 rounded-xl border-transparent")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 py-3 text-left"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + "22" }}
        >
          <CategoryIcon name={category?.icon || "Tag"} className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[15px] truncate flex items-center gap-1.5 min-w-0">
              <span className="truncate">{name}</span>
              {!recurring && (
                <span className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                  solo {monthName.toLowerCase()}
                </span>
              )}
            </span>
            <span className={cn("text-[13px] tabular-nums shrink-0", spent > amount ? "text-red-600" : "text-muted-foreground")}>
              {formatCurrency(spent)} / {formatCurrency(amount)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", barColor(spent, amount))} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </button>

      {open && (
        <div className="pb-4 space-y-3">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={`Diminuisci ${name}`}
              onClick={() => onAmountChange(nextStep(amount, -1))}
              className="w-11 h-11 rounded-full border border-border bg-background flex items-center justify-center active:bg-muted"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label={`Importo per ${name}`}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setInvalid(false);
                }}
                onFocus={() => (focused.current = true)}
                onBlur={() => {
                  focused.current = false;
                  commitText();
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className={cn(
                  "w-28 h-11 text-center text-2xl font-bold tabular-nums bg-background rounded-lg border outline-none focus:ring-2 focus:ring-primary/40",
                  invalid ? "border-red-500" : "border-border"
                )}
              />
              <span className="text-xl font-bold text-muted-foreground">€</span>
            </div>

            <button
              type="button"
              aria-label={`Aumenta ${name}`}
              onClick={() => onAmountChange(nextStep(amount, 1))}
              className="w-11 h-11 rounded-full border border-border bg-background flex items-center justify-center active:bg-muted"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <p className={cn("text-center text-xs", invalid ? "text-red-600" : "text-muted-foreground")}>
            {invalid
              ? "Inserisci un importo valido, ad esempio 450"
              : `Vale da ${monthName.toLowerCase()} in poi · passo ${BUDGET_STEP} € · tocca l'importo per scriverlo`}
          </p>

          <div className="flex items-center justify-between gap-3">
            <div className="flex bg-muted rounded-lg p-0.5 text-xs font-medium" role="group" aria-label="Ripetizione">
              <button
                type="button"
                aria-pressed={recurring}
                onClick={() => !recurring && onRecurringChange(true)}
                className={cn("px-3 py-1.5 rounded-md", recurring && "bg-background shadow-sm")}
              >
                Ogni mese
              </button>
              <button
                type="button"
                aria-pressed={!recurring}
                onClick={() => recurring && onRecurringChange(false)}
                className={cn("px-3 py-1.5 rounded-md", !recurring && "bg-background shadow-sm")}
              >
                Solo questo mese
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 px-2 py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Elimina
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
