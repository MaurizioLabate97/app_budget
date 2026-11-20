import React, { useEffect, useState } from "react";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { parseAmount } from "@/lib/format";
import { createBudgetEntry } from "@/lib/budgetActions";

/**
 * Pannello dal basso per aggiungere una voce di budget al mese.
 * `suggestions`: nomi delle categorie di spesa senza budget nel mese.
 */
export default function NewBudgetSheet({ open, onOpenChange, year, month, monthName, suggestions = [] }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setAmount("");
    setRecurring(true);
    setError("");
  }, [open]);

  async function handleSave() {
    const value = parseAmount(amount);
    if (!name.trim()) return setError("Scrivi un nome per la voce");
    if (!Number.isFinite(value) || value <= 0) return setError("Inserisci un importo valido, ad esempio 100");

    setSaving(true);
    try {
      await createBudgetEntry({ name, amount: value, recurring, year, month });
      onOpenChange(false);
      toast({ title: "Voce aggiunta" });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="pb-0">
          <DrawerTitle>Nuova voce di budget</DrawerTitle>
        </DrawerHeader>

        <div className="p-4 space-y-4 max-w-md mx-auto w-full">
          <div className="space-y-1.5">
            <Label htmlFor="nb-name">Nome</Label>
            <Input
              id="nb-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Regali"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestions.slice(0, 8).map((s, i) => (
                  <button
                    key={`${s}-${i}`}
                    type="button"
                    onClick={() => {
                      setName(s);
                      setError("");
                    }}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nb-amount">Importo per {monthName.toLowerCase()} (€)</Label>
            <Input
              id="nb-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
              }}
              placeholder="100"
            />
          </div>

          <div className="flex bg-muted rounded-lg p-1" role="group" aria-label="Ripetizione">
            <button
              type="button"
              aria-pressed={recurring}
              onClick={() => setRecurring(true)}
              className={cn("flex-1 py-2 rounded-md text-sm font-medium", recurring && "bg-background shadow-sm")}
            >
              Ogni mese
            </button>
            <button
              type="button"
              aria-pressed={!recurring}
              onClick={() => setRecurring(false)}
              className={cn("flex-1 py-2 rounded-md text-sm font-medium", !recurring && "bg-background shadow-sm")}
            >
              Solo questo mese
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base">
            {saving ? "Salvataggio..." : "Aggiungi"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
