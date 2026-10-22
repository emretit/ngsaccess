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
      <div className="flex flex-wrap gap-2" aria-label="Durum sayaçları">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((state) => (
          <Button
            key={state}
            variant={
              (state === "all" ? !filters.state : filters.state === state)
                ? "default"
                : "outline"
            }
            disabled={state === "unknown"}
            title={
              state === "unknown"
                ? "Kayıt yok: bu özellik açılmadan önceki dağıtımlar. Kişi detayında görünür; Hatalıları/Tümünü yeniden dağıt ile dolar."
                : undefined
            }
            onClick={() => {
              if (state !== "unknown")
                change({ state: state === "all" ? undefined : state });
            }}
          >
            {labels[state]}:{" "}
            {counts ? countText(counts[state], counts.capped) : "—"}
          </Button>
        ))}
      </div>
      {counts?.capped && (
        <p className="text-xs">
          Sayaçlar sınırlı taramanın alt sınırını gösterir.
        </p>
      )}
    </>
  );
}
