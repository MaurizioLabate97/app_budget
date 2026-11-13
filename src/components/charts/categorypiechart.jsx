
import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/format";

export default function CategoryPieChart({ data, total = 0 }) {
  const hasData = data && data.length > 0;

  return (
    <div className="w-full min-w-0">
      <div className="relative w-full h-[220px] sm:h-[240px] min-w-0">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={entry.color || "#94a3b8"}
                  />
                ))}
              </Pie>

              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 13,
                  maxWidth: "calc(100vw - 40px)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="w-[min(180px,65vw)] aspect-square rounded-full border-[22px] border-muted" />
          </div>
        )}

        {/* Totale al centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2">
          <span className="text-xs text-muted-foreground">
            Totale spese
          </span>

          <span className="text-base sm:text-lg font-bold tracking-tight text-center break-words max-w-full">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Legenda categorie */}
      {hasData ? (
        <div className="w-full min-w-0 space-y-3 mt-2">
          {data.map((category, index) => (
            <div
              key={`${category.name}-${index}`}
              className="w-full min-w-0 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor: category.color || "#94a3b8",
                  }}
                />

                <span className="text-sm truncate">
                  {category.name}
                </span>
              </div>

              <span className="text-sm font-medium shrink-0 tabular-nums">
                {formatCurrency(category.value)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground pb-2">
          Nessuna spesa registrata in questo mese
        </p>
      )}
    </div>
  );
}
