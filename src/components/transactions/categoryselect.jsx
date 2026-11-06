import React, { useState } from "react";
import { localData } from "@/api/localDataClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/components/categoryicon";
import { ChevronDown, Plus, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CategorySelect({ categories, current, onCategorize, type = "expense" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = categories.filter(
    (c) => c.type === type && c.name.toLowerCase().includes(query.toLowerCase())
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const cat = await localData.entities.Category.create({
        name: newName.trim(),
        type,
        color: "#6366f1",
        icon: "Tag",
        keywords: [],
      });
      onCategorize(cat.id, cat.name);
      setNewName("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  const currentCat = categories.find((c) => c.id === current);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={currentCat ? "secondary" : "outline"}
          size="sm"
          className={cn(
            "gap-1.5 h-8",
            !currentCat && "text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
          )}
        >
          {currentCat ? (
            <CategoryIcon name={currentCat.icon} className="w-3.5 h-3.5" style={{ color: currentCat.color }} />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span className="max-w-[90px] truncate">{currentCat ? currentCat.name : "Categorize"}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <div className="max-h-48 overflow-auto space-y-0.5">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onCategorize(c.id, c.name);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent text-left"
            >
              <CategoryIcon name={c.icon} className="w-4 h-4" style={{ color: c.color }} />
              <span className="flex-1 truncate">{c.name}</span>
              {c.id === current && <Check className="w-3.5 h-3.5 text-indigo-500" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">No matching categories</div>
          )}
        </div>
        <div className="mt-2 pt-2 border-t flex gap-1.5">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category..."
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()} className="shrink-0">
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}