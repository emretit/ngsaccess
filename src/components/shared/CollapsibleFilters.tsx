import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `collapseOn="all"` keeps the panel folded on desktop too (default: folds only on mobile). */
export function CollapsibleFilters({ label = "Filtreler", activeCount = 0, forceOpen = false, children, desktopDisplay = "block", buttonVariant = "outline", buttonClassName, collapseOn = "mobile" }: {
  label?: string;
  activeCount?: number;
  forceOpen?: boolean;
  children: ReactNode;
  desktopDisplay?: "block" | "contents";
  buttonVariant?: "outline" | "ghost";
  buttonClassName?: string;
  collapseOn?: "mobile" | "all";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;
  return <>
    <Button type="button" variant={buttonVariant} className={cn(collapseOn !== "all" && "md:hidden", buttonClassName)} aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {`${label}${activeCount > 0 ? ` (${activeCount})` : ""}`}
    </Button>
    <div id={id} className={collapseOn === "all" ? (expanded ? "block w-full min-w-0" : "hidden") : `${expanded ? "block" : "hidden"} ${desktopDisplay === "contents" ? "w-full min-w-0 md:contents" : "md:block"}`}>
      {children}
    </div>
  </>;
}
