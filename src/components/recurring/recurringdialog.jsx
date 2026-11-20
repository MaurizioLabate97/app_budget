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
import { todayLocal } from "@/lib/date";
import { parseAmount, formatAmountInput } from "@/lib/format";
import { periodsToSkipOnRuleChange } from "@/lib/recurring";

const NO_CATEGORY = "__none__";

export default function RecurringDialog({
  open,
  onOpenChange,
  categories,
  recurring = null,
  onSaved,
}) {
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState(NO_CATEGORY);
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(todayLocal());
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = !!recurring;
  const expenseCats = categories.filter((c) => c.type === "expense");

  useEffect(() => {
    if (!open) return;

    setAmount(recurring ? formatAmountInput(recurring.amount) : "");
    setDescription(recurring?.description || "");
    setMerchant(recurring?.merchant_name || "");
    setCategoryId(recurring?.category_id || NO_CATEGORY);
    setFrequency(recurring?.frequency || "monthly");
    setStartDate(recurring?.start_date || todayLocal());
    setEndDate(recurring?.end_date || "");
  }, [open, recurring]);

  async function handleSave() {
    const amt = parseAmount(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Inserisci un importo valido", variant: "destructive" });
      return;
    }

    if (!description.trim()) {
      toast({ title: "Inserisci una descrizione", variant: "destructive" });
      return;
    }

    if (!startDate) {
      toast({ title: "Scegli la data di inizio", variant: "destructive" });
      return;
    }

    if (endDate && endDate < startDate) {
      toast({
        title: "La data di fine deve essere successiva all'inizio",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const cat = expenseCats.find((c) => c.id === categoryId);

      const data = {
        amount: amt,
        description: description.trim(),
        merchant_name: merchant.trim(),
        category_id: cat?.id,
        category_name: cat?.name,
        frequency,
        start_date: startDate,
        end_date: endDate || undefined,
      };

      if (isEditing) {
        // Se cambia la regola, le scadenze passate della nuova regola non devono
        // ricomparire tutte insieme.
        const { items: confirmed } = await localData.entities.Transaction.filter({
          recurring_id: recurring.id,
        });
        const toSkip = periodsToSkipOnRuleChange(
          recurring,
          { ...recurring, ...data },
          confirmed,
          todayLocal()
        );

        await localData.entities.RecurringTransaction.update(recurring.id, {
          ...data,
          ...(toSkip.length && {
            skipped_periods: [...new Set([...(recurring.skipped_periods || []), ...toSkip])],
          }),
        });
      } else {
        await localData.entities.RecurringTransaction.create(data);
      }

      onSaved?.();
      onOpenChange(false);

      toast({
        title: isEditing ? "Spesa ricorrente aggiornata" : "Spesa ricorrente aggiunta",
      });
    } catch (e) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica spesa ricorrente" : "Nuova spesa ricorrente"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
              <Label>Frequenza</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensile</SelectItem>
                  <SelectItem value="yearly">Annuale</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="es. Affitto"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Esercente (facoltativo)</Label>
            <Input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="es. Netflix"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Scegli una categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Senza categoria</SelectItem>
                {expenseCats.map((c) => (
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dal</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Fino al (facoltativo)</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            La spesa scade ogni {frequency === "yearly" ? "anno" : "mese"} nel giorno della
            data di inizio. Ti verrà chiesto di confermarla prima che venga registrata.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
