import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, tone = "default", sublabel }) {
  const toneClasses = {
    default: "text-foreground",
    positive: "text-emerald-600",
    negative: "text-red-600",
    warning: "text-amber-600",
  };
  const iconBg = {
    default: "bg-slate-100 text-slate-600",
    positive: "bg-emerald-100 text-emerald-600",
    negative: "bg-red-100 text-red-600",
    warning: "bg-amber-100 text-amber-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBg[tone])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className={cn("mt-3 text-2xl font-bold tracking-tight", toneClasses[tone])}>{value}</div>
      {sublabel && <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>}
    </Card>
  );
}