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

interface LegacyPrimaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Existing object callers retain Plus by default; pass null to omit it. */
  icon?: ReactNode;
}

interface PageHeaderProps {
  title: string;
  scope?: ReactNode;
  primaryAction?: LegacyPrimaryAction | ReactNode;
  secondaryActions?: ReactNode;
  secondaryMenu?: ReactNode;
  children?: ReactNode;
  className?: string;
}
export function PageHeader({ title, scope, primaryAction, secondaryMenu, secondaryActions, children, className }: PageHeaderProps) {
  const action = primaryAction && typeof primaryAction === "object" && "label" in primaryAction
    ? <PageHeaderPrimaryButton onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
        {primaryAction.icon === undefined ? <Plus className="h-3.5 w-3.5" aria-hidden="true" /> : primaryAction.icon}
        {primaryAction.label}
      </PageHeaderPrimaryButton>
    : primaryAction;
  return <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
    <div className="min-w-0 flex-[1_1_16rem] break-words"><h1 className="text-2xl font-semibold leading-8 tracking-[-0.025em] min-[761px]:text-[26px] min-[761px]:leading-[34px]">{title}</h1>{scope && <div className="mt-1 text-sm text-muted-foreground">{scope}</div>}</div>
    <div className="flex max-w-full flex-wrap items-center gap-2">{children}{secondaryMenu}{secondaryActions}{action}</div>
  </div>;
}
