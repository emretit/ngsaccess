import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MasterDetailListLayoutProps {
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function MasterDetailListLayout({ sidebar, children, className }: MasterDetailListLayoutProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-4 min-[1100px]:flex-row min-[1100px]:gap-5", className)}>
      {sidebar}
      <div className="min-w-0 flex-1 space-y-4">{children}</div>
    </div>
  );
}
