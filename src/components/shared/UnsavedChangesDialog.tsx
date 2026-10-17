import { createUnsavedChangesGuard } from "./unsavedChanges";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function UnsavedChangesDialog({ open, onOpenChange, onConfirm }: UnsavedChangesDialogProps) {
  const trigger = useRef<HTMLElement | null>(null);
  return <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent onOpenAutoFocus={() => {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }} onCloseAutoFocus={(event) => {
      if (trigger.current?.isConnected) { event.preventDefault(); trigger.current.focus(); }
    }}>
      <AlertDialogHeader>
        <AlertDialogTitle>Değişiklikler kaydedilmedi</AlertDialogTitle>
        <AlertDialogDescription>Çıkarsanız bu formdaki kaydedilmemiş değişiklikler silinecek.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Çık</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

/** Her kapatma yolu requestClose(() => setOpen(false)) üzerinden geçmelidir. */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const [open, setOpen] = useState(false);
  const [guard] = useState(createUnsavedChangesGuard);
  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);
  const requestClose = useCallback((close: () => void) => {
    setOpen(guard.request(isDirty, close));
  }, [isDirty, guard]);
  return {
    requestClose,
    dialog: <UnsavedChangesDialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) guard.cancel();
    }} onConfirm={() => {
      setOpen(false);
      guard.confirm();
    }} />,
  };
}
