import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface InlineStat { label: string; value: string | number | null | undefined; description?: string }
export function StatInline({ items, loading = false, variant = "inline", className }: { items: readonly InlineStat[]; loading?: boolean; variant?: "inline" | "metrics"; className?: string }) {
  return <dl aria-label="Proje istatistikleri" aria-busy={loading} role={loading ? "status" : undefined} className={cn(variant === "metrics" ? "grid grid-cols-2 border-y min-[761px]:grid-cols-4 min-[761px]:py-[22px]" : "flex flex-wrap gap-x-6 gap-y-2", className)}>
    {items.map((item, index) => <div key={item.label} className={cn(variant === "metrics" ? "border-r px-3 py-4 min-[761px]:px-6 min-[761px]:py-0 min-[761px]:first:pl-0 last:border-r-0" : "flex items-center gap-2", variant === "metrics" && (index < 2 ? "border-b min-[761px]:border-b-0" : ""), variant === "metrics" && index % 2 === 1 && "max-[760px]:border-r-0")}>
      <dt className="text-xs text-muted-foreground">{item.label}</dt>
      <dd className={cn("tabular-nums", variant === "metrics" ? "mt-1 text-[30px] font-[550] leading-10 tracking-[-1px]" : "font-semibold")}>
        {loading ? <><span className="sr-only">Yükleniyor</span><Skeleton className={variant === "metrics" ? "my-2 h-6 w-16" : "h-4 w-8"} /></> : typeof item.value === "number" ? item.value.toLocaleString("tr-TR") : item.value ?? "—"}
      </dd>{item.description && <p className="mt-1 text-[11px] text-muted-foreground">{item.description}</p>}
    </div>)}
  </dl>;
}
