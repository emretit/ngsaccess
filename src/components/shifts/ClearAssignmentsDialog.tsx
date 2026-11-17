import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { errorMessage, notify } from "@/lib/notify";

export function ClearAssignmentsDialog({ projectId, onClose }: {
  projectId: Id<"projects">;
  onClose: () => void;
}) {
  const clearAll = useMutation(api.shifts.clearAllAssignments);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const run = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      let isDone = false;
      while (!isDone) {
        const result = await clearAll({ projectId });
        isDone = result.isDone;
      }
      notify.success("Tüm vardiya atamaları temizlendi.");
      onClose();
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  return <AlertDialog open onOpenChange={open => { if (!open && !lock.current) onClose(); }}>
    <AlertDialogContent className="w-[calc(100%_-_2rem)] max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>Tüm vardiya atamaları temizlensin mi?</AlertDialogTitle>
        <AlertDialogDescription>
          Bu projedeki tüm çalışan ve departman vardiya atamaları bütün tarihler için kaldırılacak. Emin misiniz?
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
        <Button variant="destructive" disabled={pending} onClick={() => void run()}>
          {pending ? "Temizleniyor…" : "Hepsini temizle"}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
