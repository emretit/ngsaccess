import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
export function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          compact
            ? "text-sm font-semibold tabular-nums"
            : "break-all text-sm font-medium tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}

export function ActionButton({
  busy,
  disabled,
  icon,
  children,
  onClick,
}: {
  busy: boolean;
  disabled: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-describedby={disabled ? "device-command-reasons" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </Button>
  );
}
