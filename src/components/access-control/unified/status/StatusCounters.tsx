import { Button } from "@/components/ui/button";
import { countText, labels, type Counts, type Filters } from "./model";

export function StatusCounters({
  filters,
  counts,
  change,
}: {
  filters: Filters;
  counts: Counts | null;
  change: (patch: Partial<Filters>) => void;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {filters.departmentId ? "Departman özeti" : "Proje özeti"} ·{" "}
        {counts ? countText(counts.all, counts.capped) : "—"} kişi–cihaz kaydı
        {/* Eski Convex sürümü personCount döndürmez; yayın arasında "undefined" yazmasın. */}
        {typeof counts?.personCount === "number" && ` · ${counts.personCount}${counts.capped ? "+" : ""} kişi`}
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Durum sayaçları">
        {(Object.keys(labels) as (keyof typeof labels)[]).filter((state) =>
          (state !== "removed" && state !== "unknown") || (counts?.[state] ?? 0) > 0 || filters.state === state,
        ).map((state) => {
          const active = state === "all" ? !filters.state : filters.state === state;
          return (
            <Button
              className="max-lg:min-h-11"
              key={state}
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => change({ state: state === "all" ? undefined : state })}
            >
              {labels[state]}:{" "}
              {counts ? countText(counts[state], counts.capped) : "—"}
            </Button>
          );
        })}
      </div>
      {counts?.capped && (
        <p className="text-xs">
          Özetin tamamı yüklenemedi; gerçek sayılar daha yüksek olabilir.
        </p>
      )}
    </>
  );
}
