import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VisitorCollapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return <div className="border-t pt-4">
    <Button type="button" variant="ghost" className="w-full justify-between px-0 font-medium" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen(previous => !previous)}>
      {title}<ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
    </Button>
    <div id={contentId} hidden={!open} className="space-y-4 pt-4">{children}</div>
  </div>;
}
