import { useRef, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export interface ConfirmActionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  errorTitle?: string;
  /** false keeps the dialog open silently; rejection reports one error toast. */
  onConfirm: () => Promise<unknown>;
}

export function ConfirmAction(props: ConfirmActionProps) {
  return <AsyncConfirmation {...props} variant="default" />;
}

/** Shared shell; destructive callers keep their own public contract and description. */
export function AsyncConfirmation({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel = "İşlem sürüyor…",
  errorTitle,
  onConfirm,
  variant,
}: ConfirmActionProps & { variant: "default" | "destructive" }) {
  const result = useRef<unknown>(undefined);
  const { run, pending } = useAsyncAction(
    async () => {
      result.current = await onConfirm();
    },
    { error: errorTitle },
  );
  const trigger = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent
        aria-busy={pending}
        onOpenAutoFocus={() => {
          trigger.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          if (trigger.current?.isConnected) {
            event.preventDefault();
            trigger.current.focus();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
          <Button
            type="button"
            variant={variant}
            disabled={pending}
            onClick={async () => {
              if ((await run()) && result.current !== false)
                onOpenChange(false);
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
