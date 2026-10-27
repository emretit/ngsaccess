import { forwardRef, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PageHeaderPrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <Button ref={ref} size="sm" className={cn("min-h-11 md:min-h-8 gap-1.5 text-xs", className)} {...props} />
  ),
);
PageHeaderPrimaryButton.displayName = "PageHeaderPrimaryButton";

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
    <div className="flex flex-wrap items-center gap-2">{children}{secondaryMenu}{primaryAction && <PageHeaderPrimaryButton onClick={primaryAction.onClick} disabled={primaryAction.disabled}><Plus className="h-3.5 w-3.5" aria-hidden="true" />{primaryAction.label}</PageHeaderPrimaryButton>}</div>
  </div>;
}
