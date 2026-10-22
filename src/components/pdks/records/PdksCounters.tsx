import type { PdksRecordsView } from "./usePdksRecordsView";
import { STATUS_META, IN_PROGRESS_META } from "@/components/pdks/statusMeta";
import { formatDuration } from "@/components/pdks/lib/presentation";
export function PdksCounters({ summary, counters, inProgress, filters }: Pick<PdksRecordsView, "summary" | "counters" | "inProgress" | "filters">) {
  return (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3 text-xs tabular-nums"
            aria-label="Durum özeti"
          >
            <span>{summary.totalEmployees} personel</span>
            {counters.map((c) => (
              <span key={c.status}>
                {STATUS_META[c.status].label} <strong>{c.value}</strong>{" "}
                {filters.reportType === "daily" ? "kişi" : "kişi-gün"}
              </span>
            ))}
            {inProgress > 0 && <span>{IN_PROGRESS_META.label} <strong>{inProgress}</strong> {filters.reportType === "daily" ? "kişi" : "kişi-gün"}</span>}
            <span>
              Fazla mesai{" "}
              {formatDuration(Math.round(summary.overtimeHours * 60))}
            </span>
          </div>
  );
}
