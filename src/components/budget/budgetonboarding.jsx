import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { localData } from "@/api/localDataClient";
import { parseAmount } from "@/lib/format";
import { createBudgetEntry } from "@/lib/budgetActions";

const DISMISSED_KEY = "app_budget_onboarding_done_v1";
const DEFAULT_ROWS = ["Mutuo", "Alcol", "Spesa"];

function isDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Senza storage il popup potrebbe ricomparire: nessun danno ai dati.
  }
}

let nextKey = 0;
const row = (name = "") => ({ key: nextKey++, name, amount: "" });

/** Popup del primo avvio: crea le prime voci di budget del mese corrente. */
export default function BudgetOnboarding() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() => DEFAULT_ROWS.map((n) => row(n)));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDismissed()) return;
    localData.entities.Budget.filter({}, { limit: 1 })
      .then(({ total }) => total === 0 && setOpen(true))
      .catch(() => undefined);
  }, []);

  function close() {
    dismiss();
    setOpen(false);
  }

  function update(key, field, value) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setError("");
  }

  async function save() {
    // Le righe senza importo si saltano: basta compilare quelle che interessano.
    const filled = rows.filter((r) => r.amount.trim());
    if (filled.length === 0) return setError("Inserisci l'importo di almeno una voce, oppure scegli Più tardi");

    const bad = filled.find((r) => !r.name.trim() || !(parseAmount(r.amount) > 0));
    if (bad) {
      return setError(
        bad.name.trim()
          ? `Inserisci un importo valido per ${bad.name.trim()}`
          : "Ogni voce con un importo ha bisogno di un nome"
      );
    }

    const names = filled.map((r) => r.name.trim().toLocaleLowerCase("it-IT"));
    if (new Set(names).size !== names.length) return setError("Ci sono due voci con lo stesso nome");

    setSaving(true);
    const now = new Date();
    try {
      for (const r of filled) {
        await createBudgetEntry({
          name: r.name,
          amount: parseAmount(r.amount),
          recurring: true,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          // Se un tentativo precedente si è fermato a metà, le voci già create vanno bene così.
          skipIfExists: true,
        });
      }
      toast({ title: "Budget impostati", description: "Li trovi nella pagina Budget." });
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && close()}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imposta i tuoi budget mensili</DialogTitle>
          <DialogDescription>
            Scegli quanto vuoi spendere al massimo ogni mese per queste voci. Si ripropongono da sole il mese
            dopo e puoi cambiarle quando vuoi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <Input
                aria-label="Nome della voce"
                value={r.name}
                onChange={(e) => update(r.key, "name", e.target.value)}
                placeholder="Nome"
                className="flex-1 min-w-0"
              />
              <div className="relative w-28 shrink-0">
                <Input
                  aria-label={`Importo per ${r.name || "la voce"}`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={r.amount}
                  onChange={(e) => update(r.key, "amount", e.target.value)}
                  placeholder="0"
                  className="pr-7 text-right tabular-nums"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
              <button
                type="button"
                aria-label={`Togli ${r.name || "questa voce"}`}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, row()])}
            className="w-full rounded-xl border-[1.5px] border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Aggiungi voce
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={close} disabled={saving}>
            Più tardi
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva budget"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
