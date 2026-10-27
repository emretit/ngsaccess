import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ResponsiveResultsProps = {
  label: string;
  desktop: ReactNode;
  mobile: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function ResponsiveResults({ label, desktop, mobile, footer, className }: ResponsiveResultsProps) {
  return (
    <div role="group" aria-label={label} className={cn("min-w-0", className)}>
      <div className="hidden min-w-0 max-w-full overflow-x-auto rounded-md border md:block">{desktop}</div>
      <div className="min-w-0 rounded-md border md:hidden">{mobile}</div>
      {footer}
    </div>
  );
}
