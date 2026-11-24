import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";

import { CategoryIcon } from "@/components/categoryicon";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDayMonth, monthLabel } from "@/lib/format";

const TREND_THRESHOLD = 0.1;

function Trend({ delta }) {
  if (delta === null || Math.abs(delta) < TREND_THRESHOLD) return <span className="w-12 shrink-0" />;
  const up = delta > 0;
  return (
    <span
      className={cn("w-12 shrink-0 text-right font-semibold", up ? "text-red-600" : "text-emerald-600")}
      aria-label={`${up ? "In aumento" : "In calo"} del ${Math.round(Math.abs(delta) * 100)}%`}
    >
      {up ? "↑" : "↓"} {Math.round(Math.abs(delta) * 100)}%
    </span>
  );
}

/** Riga della classifica: toccandola mostra l'andamento mese per mese e le spese più grosse. */
export default function StatsRow({ row, maxAvg, open, onToggle, onEditTransaction }) {
  const chartData = row.monthly.map((m) => ({ label: monthLabel(m.key), total: m.total }));

  return (
    <div className={cn("border-b border-border", open && "bg-muted/40 -mx-3 px-3 rounded-xl border-transparent")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 py-3 text-left">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: row.color + "22" }}
        >
          <CategoryIcon name={row.icon} className="w-4 h-4" style={{ color: row.color }} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-[15px] truncate">{row.name}</span>
            <span className="text-[15px] font-semibold tabular-nums shrink-0">
              {formatCurrency(row.avg)}
              <span className="text-xs font-normal text-muted-foreground"> /mese</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${maxAvg > 0 ? (row.avg / maxAvg) * 100 : 0}%`, backgroundColor: row.color }}
              />
            </div>
            <span className="w-8 shrink-0 text-right">{Math.round(row.share * 100)}%</span>
            <Trend delta={row.delta} />
          </div>
        </div>
      </button>

      {open && (
        <div className="pb-4 space-y-3">
          <div className="h-28" aria-label="Andamento mese per mese">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(v), "Totale"]}
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 13 }}
                />
                <Bar dataKey="total" fill={row.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Le spese più grosse del periodo</p>
            {row.top.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onEditTransaction(t)}
                className="w-full flex items-center justify-between gap-3 py-2 border-t border-border text-left text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="text-xs text-muted-foreground mr-2 tabular-nums">{formatDayMonth(t.date, false)}</span>
                  {t.merchant_name || t.description || "Movimento"}
                </span>
                <span className="font-semibold tabular-nums shrink-0">{formatCurrency(t.amount)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
