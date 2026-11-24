
import React, { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { localData } from "@/api/localDataClient";
import { useToast } from "@/components/ui/use-toast";
import { CategoryIcon } from "@/components/categoryicon";
import { cn } from "@/lib/utils";
import { todayLocal } from "@/lib/date";
import { parseAmount, formatAmountInput } from "@/lib/format";

export default function AddTransactionDialog({
  open,
  onOpenChange,
  categories,
  onAdded,
  transaction = null,
}) {
  const { toast } = useToast();

  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!transaction;

  useEffect(() => {
    if (!open) return;

    if (transaction) {
      setType(transaction.type || "expense");
      setAmount(formatAmountInput(transaction.amount));
      setDate(transaction.date || todayLocal());
      setDescription(transaction.description || "");
      setMerchant(transaction.merchant_name || "");
      setCategoryId(transaction.category_id || "");
    } else {
      setType("expense");
      setAmount("");
      setDescription("");
      setMerchant("");
      setCategoryId("");
      setDate(todayLocal());
    }
  }, [open, transaction]);

  const filteredCats = categories.filter((c) => c.type === type);

  async function handleSave() {
    const amt = parseAmount(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Inserisci un importo valido", variant: "destructive" });
      return;
    }

    if (!date) {
      toast({ title: "Scegli una data", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      const cat = categories.find((c) => c.id === categoryId);

      const data = {
        amount: amt,
        type,
        date,
        description: description || merchant,
        merchant_name: merchant,
        category_id: categoryId || undefined,
        category_name: cat?.name,
        is_categorized: !!categoryId,
      };

      if (isEditing) {
        await localData.entities.Transaction.update(transaction.id, data);
      } else {
        await localData.entities.Transaction.create({
          ...data,
          source: "manual",
        });
      }

      onAdded?.();
      onOpenChange(false);

      toast({
        title: isEditing ? "Movimento aggiornato" : "Movimento aggiunto",
      });
    } catch (e) {
      toast({
        title: "Errore",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica movimento" : "Nuovo movimento"}
          </DialogTitle>
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
              Spesa
            </Button>

            <Button
              variant={type === "income" ? "default" : "outline"}
              className={cn(type === "income" && "bg-emerald-600 hover:bg-emerald-700")}
              onClick={() => {
                setType("income");
                setCategoryId("");
              }}
            >
              Entrata
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Importo (€)</Label>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="es. Spesa al supermercato"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Esercente (facoltativo)</Label>
            <Input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Esselunga"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Scegli una categoria" />
              </SelectTrigger>

              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <CategoryIcon
                        name={c.icon}
                        className="w-4 h-4"
                        style={{ color: c.color }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annulla
          </Button>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : isEditing ? "Salva" : "Aggiungi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
