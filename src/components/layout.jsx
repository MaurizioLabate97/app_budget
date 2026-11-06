import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import AddExpenseSheet from "./AddExpenseSheet";

export default function Layout() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className="flex flex-col h-screen bg-background">
      <main className="flex-1 overflow-auto pb-24">
        <Outlet />
      </main>
      <BottomNav onAdd={() => setAddOpen(true)} />
      <AddExpenseSheet open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}