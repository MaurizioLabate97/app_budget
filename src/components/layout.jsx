
import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import AddExpenseSheet from "./AddExpenseSheet";
import BudgetOnboarding from "./budget/budgetonboarding";

export default function Layout() {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col w-full min-h-[100dvh] bg-background overflow-x-clip">
      <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-clip pb-24">
        <Outlet />
      </main>

      <BottomNav onAdd={() => setAddOpen(true)} />

      <AddExpenseSheet
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <BudgetOnboarding />
    </div>
  );
}
