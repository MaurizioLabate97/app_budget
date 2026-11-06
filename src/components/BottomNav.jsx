import React from "react";
import { NavLink } from "react-router-dom";
import { Home, ArrowLeftRight, Target, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/transactions", label: "Activity", icon: ArrowLeftRight, end: false },
  { to: "/budgets", label: "Budgets", icon: Target, end: false },
  { to: "/more", label: "More", icon: MoreHorizontal, end: false },
];

export default function BottomNav({ onAdd }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto relative">
        {tabs.slice(0, 2).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="flex flex-col items-center gap-0.5 flex-1 py-2">
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-[10px]", isActive ? "text-primary font-medium" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}

        <button
          onClick={onAdd}
          className="w-14 h-14 -mt-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0"
        >
          <Plus className="w-7 h-7" />
        </button>

        {tabs.slice(2).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="flex flex-col items-center gap-0.5 flex-1 py-2">
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-[10px]", isActive ? "text-primary font-medium" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}