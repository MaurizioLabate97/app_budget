import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localData } from "@/api/localDataClient";
import { useToast } from "@/components/ui/use-toast";
import { CategoryIcon } from "@/components/categoryicon";
import { cn } from "@/lib/utils";

export default function AddExpenseSheet({ open, onOpenChange }) {
  const { toast } = useToast();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType("expense");
      setAmount("");
      setCategoryId("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      loadCategories();
    }
  }, [open]);

  async function loadCategories() {
    try {
      const res = await localData.entities.Category.filter({}, { sort: "name", limit: 100 });
      setCategories(res.items);
    } catch (e) {}
  }

  const filteredCats = categories.filter((c) => c.type === type);

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === categoryId);
      await localData.entities.Transaction.create({
        amount: amt,
        type,
        date,
        description: description || cat?.name || "",
        category_id: categoryId || undefined,
        category_name: cat?.name,
        is_categorized: !!categoryId,
        source: "manual",
      });
      window.dispatchEvent(new CustomEvent("expense-added"));
      onOpenChange(false);
      toast({ title: type === "income" ? "Income added" : "Expense added" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="pb-0">
          <DrawerTitle>Add {type === "income" ? "income" : "expense"}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6 pt-2 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
            <button
              className={cn(
                "py-2 rounded-lg text-sm font-medium transition-colors",
                type === "expense" ? "bg-red-500 text-white" : "text-muted-foreground"
              )}
              onClick={() => {
                setType("expense");
                setCategoryId("");
              }}
            >
              Expense
            </button>
            <button
              className={cn(
                "py-2 rounded-lg text-sm font-medium transition-colors",
                type === "income" ? "bg-emerald-500 text-white" : "text-muted-foreground"
              )}
              onClick={() => {
                setType("income");
                setCategoryId("");
              }}
            >
              Income
            </button>
          </div>

          <div className="text-center py-3">
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-muted-foreground">€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-4xl font-bold bg-transparent border-none outline-none text-center w-44 placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {filteredCats.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-4 text-center py-2">
                  No categories yet. Add some from the Categories page.
                </p>
              ) : (
                filteredCats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all",
                      categoryId === c.id ? "border-primary bg-primary/5" : "border-transparent bg-muted"
                    )}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: (c.color || "#6366f1") + "20" }}
                    >
                      <CategoryIcon name={c.icon} className="w-5 h-5" style={{ color: c.color }} />
                    </div>
                    <span className="text-[11px] font-medium truncate w-full text-center">{c.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
          />

          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base">
            {saving ? "Saving..." : `Add ${type === "income" ? "income" : "expense"}`}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}