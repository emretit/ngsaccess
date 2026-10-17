import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  scope?: ReactNode;
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  secondaryMenu?: ReactNode;
  children?: ReactNode;
  className?: string;
}
export function PageHeader({ title, scope, primaryAction, secondaryMenu, children, className }: PageHeaderProps) {
  return <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
    <div className="min-w-0"><h1 className="text-2xl font-semibold leading-8 tracking-[-0.025em] min-[761px]:text-[26px] min-[761px]:leading-[34px]">{title}</h1>{scope && <div className="mt-1 text-sm text-muted-foreground">{scope}</div>}</div>
    <div className="flex flex-wrap items-center gap-2">{children}{secondaryMenu}{primaryAction && <Button onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.label}</Button>}</div>
  </div>;
}
