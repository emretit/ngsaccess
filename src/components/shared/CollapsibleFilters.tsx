import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function CollapsibleFilters({ label = "Filtreler", activeCount = 0, forceOpen = false, children, desktopDisplay = "block", buttonVariant = "outline", buttonClassName }: {
  label?: string;
  activeCount?: number;
  forceOpen?: boolean;
  children: ReactNode;
  desktopDisplay?: "block" | "contents";
  buttonVariant?: "outline" | "ghost";
  buttonClassName?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;
  return <>
    <Button type="button" variant={buttonVariant} className={`md:hidden${buttonClassName ? ` ${buttonClassName}` : ""}`} aria-expanded={expanded} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {`${label}${activeCount > 0 ? ` (${activeCount})` : ""}`}
    </Button>
    <div id={id} className={`${expanded ? "block" : "hidden"} ${desktopDisplay === "contents" ? "w-full min-w-0 md:contents" : "md:block"}`}>
      {children}
    </div>
  </>;
}
