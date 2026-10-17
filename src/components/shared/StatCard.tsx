import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "success" | "warning" | "danger" | "info" | "purple";

interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  loading?: boolean;
  Icon: LucideIcon;
  tone?: StatTone;
  /** Küçük yardımcı metin (örn. yüzde) */
  meta?: string;
  className?: string;
}

// Eski sayfalar (C2'ye kadar) durum rengini rakamda korur; renk yalnız token'lardan.
const toneText: Record<StatTone, string> = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  purple: "text-info",
};

export function StatCard({ label, value, Icon, tone = "default", meta, className, loading = false }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3 flex items-center gap-3", className)}>
      <div className={"shrink-0 text-muted-foreground"}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={cn("text-[30px] font-[550] tabular-nums leading-tight", toneText[tone])} aria-busy={loading}>{loading ? "Yükleniyor…" : value ?? "—"}</p>
        {meta && <p className={"text-xs text-muted-foreground"}>{meta}</p>}
      </div>
    </div>
  );
}
