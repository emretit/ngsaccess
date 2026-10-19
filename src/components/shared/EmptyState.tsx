import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  compact?: boolean;
  /** Disable live announcements for static informational content. */
  live?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
  live = true,
}: EmptyStateProps) {
  return (
    <div
      role={live ? "status" : undefined}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        compact && "min-h-0 py-6",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-8 w-8 items-center justify-center ">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="default"
          size="sm"
          onClick={action.onClick}
          className="mt-6"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
