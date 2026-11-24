
import React, { useState, useEffect } from "react";
import {
  localData,
  getCategoryUsage,
  deleteCategoryCascade,
} from "@/api/localDataClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { CategoryIcon } from "@/components/categoryicon";
import CategoryDialog from "@/components/categories/categorydialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { isFixedCategory } from "@/lib/stats";

export default function Categories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null); // { category, usage }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await localData.entities.Category.filter(
        {},
        { sort: "name", limit: 100 }
      );
      setCategories(res.items);
    } catch (e) {
      toast({
        title: "Errore",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function askDelete(cat) {
    try {
      const usage = await getCategoryUsage(cat.id);
      setToDelete({ category: cat, usage });
    } catch (e) {
      toast({
        title: "Errore",
        description: e.message,
        variant: "destructive",
      });
    }
  }

  function deleteDescription({ category, usage }) {
    const parts = [];
    if (usage.transactions > 0) {
      parts.push(
        `${usage.transactions} ${usage.transactions === 1 ? "transazione resterà" : "transazioni resteranno"} senza categoria`
      );
    }
    if (usage.budgets > 0) {
      parts.push(
        `${usage.budgets} ${usage.budgets === 1 ? "budget verrà eliminato" : "budget verranno eliminati"}`
      );
    }
    if (usage.recurrings > 0) {
      parts.push(
        `${usage.recurrings} ${usage.recurrings === 1 ? "spesa ricorrente resterà" : "spese ricorrenti resteranno"} senza categoria`
      );
    }
    const list =
      parts.length > 1 ? `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}` : parts[0];
    return parts.length
      ? `La categoria "${category.name}" è in uso: ${list}.`
      : `La categoria "${category.name}" non è usata da nessuna transazione, budget o spesa ricorrente.`;
  }

  async function handleDelete(cat) {
    try {
      await deleteCategoryCascade(cat.id);
      load();
      toast({ title: "Categoria eliminata" });
    } catch (e) {
      toast({
        title: "Errore",
        description: e.message,
        variant: "destructive",
      });
    }
  }

  const expense = categories.filter((c) => c.type === "expense");
  const income = categories.filter((c) => c.type === "income");

  function renderGroup(title, items) {
    return (
      <div className="w-full min-w-0">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          {title} ({items.length})
        </h3>

        <div className="grid grid-cols-1 gap-3 w-full min-w-0">
          {items.map((c) => (
            <Card
              key={c.id}
              className="w-full min-w-0 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 overflow-hidden"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: (c.color || "#6366f1") + "20",
                }}
              >
                <CategoryIcon
                  name={c.icon}
                  className="w-5 h-5"
                  style={{ color: c.color || "#6366f1" }}
                />
              </div>

              <span className="font-medium flex-1 min-w-0 flex items-center gap-1.5">
                <span className="truncate">{c.name}</span>
                {c.type === "expense" && isFixedCategory(c) && (
                  <span className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    fissa
                  </span>
                )}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-60 sm:opacity-40"
                onClick={() => {
                  setEditing(c);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-60 sm:opacity-40 text-muted-foreground hover:text-red-600"
                onClick={() => askDelete(c)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-md mx-auto space-y-6 px-3 sm:px-4 pt-4 pb-6">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            Categorie
          </h1>
          <p className="text-sm text-muted-foreground">
            Crea le categorie man mano che ti servono
          </p>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuova
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="w-full min-w-0 space-y-6">
          {renderGroup("Spese", expense)}
          {renderGroup("Entrate", income)}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminare la categoria?"
        description={toDelete ? deleteDescription(toDelete) : ""}
        onConfirm={() => handleDelete(toDelete.category)}
      />

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        onSaved={load}
      />
    </div>
  );
}
