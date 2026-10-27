import {
  useRef,
  type FormEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface FormDialogProps {
  open: boolean;
  onRequestClose: () => void;
  pending: boolean;
  title: string;
  description?: ReactNode;
  size?: "sm" | "md" | "lg";
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer: ReactNode;
  returnFocus?: RefObject<HTMLElement | null>;
}

export function FormDialog({
  open,
  onRequestClose,
  pending,
  title,
  description,
  size = "md",
  onSubmit,
  children,
  footer,
  returnFocus,
}: FormDialogProps) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onRequestClose();
      }}
    >
      <DialogContent
        className={cn("flex max-h-[90dvh] flex-col overflow-hidden", {
          "sm:max-w-[440px]": size === "sm",
          "sm:max-w-lg": size === "md",
          "sm:max-w-2xl": size === "lg",
        })}
        aria-busy={pending}
        {...(description == null ? { "aria-describedby": undefined } : {})}
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocus?.current ?? opener.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description != null && (
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          )}
        </DialogHeader>
        <form
          noValidate
          onSubmit={onSubmit}
          aria-busy={pending}
          className="flex min-h-0 flex-col gap-4"
        >
          <div className="min-h-0 space-y-4 overflow-y-auto">{children}</div>
          <div className="shrink-0">{footer}</div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
