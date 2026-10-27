import { useRef } from "react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export interface ConfirmDestructiveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  objectName: string;
  effects: string[];
  confirmLabel: string;
  errorTitle?: string;
  onConfirm: () => Promise<unknown>;
}

export function ConfirmDestructive({
  open, onOpenChange, title, objectName, effects, confirmLabel, errorTitle, onConfirm,
}: ConfirmDestructiveProps) {
  const { run, pending } = useAsyncAction(onConfirm, { error: errorTitle });
  const trigger = useRef<HTMLElement | null>(null);

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!pending) onOpenChange(next); }}>
      <AlertDialogContent
        aria-busy={pending}
        onOpenAutoFocus={() => {
          trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (trigger.current?.isConnected) {
            event.preventDefault();
            trigger.current.focus();
          }
        }}
        onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="font-medium text-foreground">{objectName}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {effects.map((effect, index) => <li key={index}>{effect}</li>)}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={async () => {
            if (await run()) onOpenChange(false);
          }}>
            {pending ? "İşlem sürüyor…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
