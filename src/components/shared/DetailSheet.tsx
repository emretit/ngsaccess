import { useRef, type ComponentProps, type ReactNode, type RefObject } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface DetailSheetProps {
  open: boolean;
  onRequestClose: () => void;
  title: ReactNode;
  description: ReactNode;
  size?: "md" | "lg" | "wide";
  pending?: boolean;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  returnFocus?: RefObject<HTMLElement | null>;
  scroll?: "body" | "all";
  // Preserve existing focus hooks and nested form layouts during adoption.
  focusTitleOnOpen?: boolean;
  descriptionId?: string;
  headerClassName?: string;
  bodyClassName?: string;
  contentProps?: Omit<ComponentProps<typeof SheetContent>, "children" | "size" | "aria-describedby">;
}

const widths = {
  md: "sm:max-w-md md:max-w-lg",
  lg: "sm:w-[700px] sm:max-w-[700px] md:max-w-[700px]",
  wide: "sm:max-w-[720px]",
};

export function DetailSheet({
  open, onRequestClose, title, description, size = "md", pending = false,
  headerExtra, children, footer, returnFocus, scroll = "body", focusTitleOnOpen = false,
  descriptionId, headerClassName, bodyClassName, contentProps = {},
}: DetailSheetProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { className, onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown, onInteractOutside, ...rest } = contentProps;
  return <Sheet open={open} onOpenChange={next => { if (!next && !pending) onRequestClose(); }}>
    <SheetContent
      {...rest}
      size="full"
      aria-describedby={descriptionId}
      className={cn("flex w-full min-w-0 flex-col gap-0 p-0", widths[size], scroll === "all" ? "overflow-y-auto" : "overflow-hidden", className)}
      onOpenAutoFocus={event => {
        onOpenAutoFocus?.(event);
        if (!event.defaultPrevented && focusTitleOnOpen) {
          event.preventDefault();
          titleRef.current?.focus();
        }
      }}
      onCloseAutoFocus={event => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented && returnFocus) {
          event.preventDefault();
          returnFocus.current?.focus();
        }
      }}
      onEscapeKeyDown={event => { if (pending) event.preventDefault(); onEscapeKeyDown?.(event); }}
      onInteractOutside={event => { if (pending) event.preventDefault(); onInteractOutside?.(event); }}
    >
      <SheetHeader className={cn("shrink-0 space-y-1 px-5 py-3", headerClassName)}>
        <SheetTitle ref={titleRef} tabIndex={focusTitleOnOpen ? -1 : undefined} className="break-words outline-none">{title}</SheetTitle>
        {headerExtra}
        <SheetDescription id={descriptionId}>{description}</SheetDescription>
      </SheetHeader>
      <div className={cn("min-w-0 flex-1", scroll === "body" ? "min-h-0 overflow-y-auto" : "flex flex-col gap-4 px-6 pb-6", bodyClassName)}>{children}</div>
      {footer}
    </SheetContent>
  </Sheet>;
}
