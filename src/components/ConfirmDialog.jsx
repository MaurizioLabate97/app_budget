import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Dialog di conferma riutilizzabile (es. eliminazioni).
 * onConfirm può essere async: il dialog resta aperto finché non termina.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Elimina",
  cancelLabel = "Annulla",
  destructive = true,
  onConfirm,
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm(event) {
    // Evita la chiusura automatica di Radix: chiudiamo noi a operazione finita.
    event.preventDefault();
    setBusy(true);
    try {
      await onConfirm?.();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription asChild={typeof description !== "string"}>
              {typeof description === "string" ? description : <div>{description}</div>}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={busy}
            className={cn(destructive && buttonVariants({ variant: "destructive" }))}
          >
            {busy ? "Attendere..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
