import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon } from "@/components/categoryicon";
import { localData } from "@/api/localDataClient";
import { useToast } from "@/components/ui/use-toast";

export default function BudgetDialog({ open, onOpenChange, categories, month, year, existing, onSaved }) {
  const { toast } = useToast();
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const expenseCats = categories.filter((c) => c.type === "expense");

  useEffect(() => {
    if (open) {
      setCategoryId(existing?.category_id || "");
      setLimit(existing ? String(existing.amount_limit) : "");
    }
  }, [open, existing]);

  async function handleSave() {
    const lim = parseFloat(limit);
    if (!categoryId) {
      toast({ title: "Choose a category", variant: "destructive" });
      return;
    }
    if (!lim || lim <= 0) {
      toast({ title: "Enter a limit", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === categoryId);
      if (existing) {
        await localData.entities.Budget.update(existing.id, { amount_limit: lim });
      } else {
        await localData.entities.Budget.create({
          category_id: categoryId,
          category_name: cat?.name,
          month,
          year,
          amount_limit: lim,
        });
      }
      onSaved();
      onOpenChange(false);
      toast({ title: "Budget saved" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit budget" : "Set a budget"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={!!existing}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <CategoryIcon name={c.icon} className="w-4 h-4" style={{ color: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Monthly limit (€)</Label>
            <Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}