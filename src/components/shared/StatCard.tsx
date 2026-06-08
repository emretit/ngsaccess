import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "success" | "warning" | "danger" | "info" | "purple";

const toneStyles: Record<StatTone, { icon: string; label: string }> = {
  default: {
    icon: "bg-muted text-foreground",
    label: "text-muted-foreground",
  },
  success: {
    icon: "bg-[hsl(var(--success-subtle))] text-[hsl(var(--success))]",
    label: "text-[hsl(var(--success))]",
  },
  warning: {
    icon: "bg-[hsl(var(--warning-subtle))] text-[hsl(var(--warning))]",
    label: "text-[hsl(var(--warning))]",
  },
  danger: {
    icon: "bg-[hsl(var(--destructive)/0.1)] text-destructive",
    label: "text-destructive",
  },
  info: {
    icon: "bg-[hsl(var(--info-subtle))] text-[hsl(var(--info))]",
    label: "text-[hsl(var(--info))]",
  },
  purple: {
    icon: "status-purple-badge",
    label: "text-[hsl(270_60%_35%)] dark:text-[hsl(270_60%_75%)]",
  },
};

interface StatCardProps {
  label: string;
  value: string | number;
  Icon: LucideIcon;
  tone?: StatTone;
  /** Küçük yardımcı metin (örn. yüzde) */
  meta?: string;
  className?: string;
}

export function StatCard({ label, value, Icon, tone = "default", meta, className }: StatCardProps) {
  const styles = toneStyles[tone];
  return (
    <div className={cn("rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3", className)}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
        {meta && <p className={cn("text-xs font-medium leading-none", styles.label)}>{meta}</p>}
      </div>
    </div>
  );
}
