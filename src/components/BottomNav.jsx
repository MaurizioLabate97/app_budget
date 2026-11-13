
import React from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  ArrowLeftRight,
  Target,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/transactions", label: "Activity", icon: ArrowLeftRight, end: false },
  { to: "/budgets", label: "Budgets", icon: Target, end: false },
  { to: "/more", label: "More", icon: MoreHorizontal, end: false },
];

export default function BottomNav({ onAdd }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 w-full border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto flex h-16 w-full max-w-md items-center justify-around px-2">
        {tabs.slice(0, 2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2"
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] leading-tight",
                    isActive
                      ? "font-medium text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={onAdd}
          aria-label="Add transaction"
          className="relative -mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-7 w-7" />
        </button>

        {tabs.slice(2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2"
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] leading-tight",
                    isActive
                      ? "font-medium text-primary"
                      : "text-muted-foreground"
                  )}
                >
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
