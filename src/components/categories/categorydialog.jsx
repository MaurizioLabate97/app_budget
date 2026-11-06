import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon, ICON_NAMES } from "@/components/categoryicon";
import { localData } from "@/api/localDataClient";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const COLORS = [
  "#6366f1", "#22c55e", "#ef4444", "#f97316", "#eab308", "#8b5cf6",
  "#ec4899", "#06b6d4", "#14b8a6", "#f43f5e", "#84cc16", "#0ea5e9",
];

export default function CategoryDialog({ open, onOpenChange, category, onSaved }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [color, setColor] = useState("#6366f1");
  const [icon, setIcon] = useState("Tag");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name || "");
      setType(category?.type || "expense");
      setColor(category?.color || "#6366f1");
      setIcon(category?.icon || "Tag");
    }
  }, [open, category]);

  async function handleSave() {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (category) {
        await localData.entities.Category.update(category.id, { name: name.trim(), type, color, icon });
      } else {
        await localData.entities.Category.create({ name: name.trim(), type, color, icon, keywords: [] });
      }
      onSaved();
      onOpenChange(false);
      toast({ title: category ? "Category updated" : "Category created" });
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
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2",
                    color === c ? "ring-2 ring-offset-2 ring-slate-400 border-white" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-auto p-1">
              {ICON_NAMES.map((n) => (
                <button
                  key={n}
                  onClick={() => setIcon(n)}
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center border",
                    icon === n ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-100"
                  )}
                >
                  <CategoryIcon name={n} className="w-4 h-4" />
                </button>
              ))}
            </div>
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