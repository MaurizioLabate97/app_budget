import React, { useState, useEffect } from "react";
import { localData } from "@/api/localDataClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { CategoryIcon } from "@/components/categoryicon";
import CategoryDialog from "@/components/categories/categorydialog";

export default function Categories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await localData.entities.Category.filter({}, { sort: "name", limit: 100 });
      setCategories(res.items);
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(cat) {
    try {
      await localData.entities.Category.delete(cat.id);
      load();
      toast({ title: "Category deleted" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const expense = categories.filter((c) => c.type === "expense");
  const income = categories.filter((c) => c.type === "income");

  function renderGroup(title, items) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          {title} ({items.length})
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {items.map((c) => (
            <Card key={c.id} className="p-4 flex items-center gap-3 group">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: (c.color || "#6366f1") + "20" }}
              >
                <CategoryIcon name={c.icon} className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <span className="font-medium flex-1 truncate">{c.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-40"
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
                className="h-8 w-8 opacity-40 text-muted-foreground hover:text-red-600"
                onClick={() => handleDelete(c)}
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
    <div className="space-y-6 p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">Build your categories as you go</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {renderGroup("Expenses", expense)}
          {renderGroup("Income", income)}
        </div>
      )}
      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} onSaved={load} />
    </div>
  );
}