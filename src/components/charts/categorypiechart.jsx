
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
    <div className="w-full">
      <div className="relative w-full h-[240px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={100}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>

              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="w-[200px] h-[200px] rounded-full border-[24px] border-muted" />
          </div>
        )}

        {/* Totale al centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground">
            Totale spese
          </span>
          <span className="text-lg font-bold tracking-tight">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Legenda categorie */}
      {hasData ? (
        <div className="space-y-3 mt-2">
          {data.map((category, index) => (
            <div
              key={`${category.name}-${index}`}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm truncate">
                  {category.name}
                </span>
              </div>

              <span className="text-sm font-medium shrink-0">
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
