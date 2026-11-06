import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localData } from "@/api/localDataClient";
import { useToast } from "@/components/ui/use-toast";
import { CategoryIcon } from "@/components/categoryicon";
import { cn } from "@/lib/utils";

export default function AddTransactionDialog({ open, onOpenChange, categories, onAdded }) {
  const { toast } = useToast();
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType("expense");
      setAmount("");
      setDescription("");
      setMerchant("");
      setCategoryId("");
      setDate(new Date().toISOString().split("T")[0]);
    }
  }, [open]);

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
        description: description || merchant,
        merchant_name: merchant,
        category_id: categoryId || undefined,
        category_name: cat?.name,
        is_categorized: !!categoryId,
        source: "manual",
      });
      onAdded();
      onOpenChange(false);
      toast({ title: "Transaction added" });
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
          <DialogTitle>Add transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={type === "expense" ? "destructive" : "outline"}
              onClick={() => {
                setType("expense");
                setCategoryId("");
              }}
            >
              Expense
            </Button>
            <Button
              variant={type === "income" ? "default" : "outline"}
              className={cn(type === "income" && "bg-emerald-600 hover:bg-emerald-700")}
              onClick={() => {
                setType("income");
                setCategoryId("");
              }}
            >
              Income
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (€)</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Grocery shopping" />
          </div>
          <div className="space-y-1.5">
            <Label>Merchant (optional)</Label>
            <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Esselunga" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}