import { StatusBadge } from "@/components/shared/StatusBadge";
import { STATUS_META } from "../statusMeta";
import { segmentTimeRange, formatDuration, segmentDecisionLabel, SEGMENT_DECISION_LABELS, type PdksPlanDay } from "../lib/presentation";

export function PdksDaySegments({ day }: { day: PdksPlanDay }) {
  if (!day.segments || day.segments.length < 2) return null;
  return <section aria-label="Günün vardiyaları" className="space-y-3">
    <h4 className="text-sm font-medium">Günün vardiyaları · {day.segments.length} vardiya</h4>
    <ol className="divide-y rounded-md border px-3">
      {day.segments.map((segment, index) => {
        const label = segmentDecisionLabel(segment, day.status);
        const tone = label === SEGMENT_DECISION_LABELS[segment.decision] ? STATUS_META[segment.decision].tone : "neutral";
        return <li key={`${segment.shiftId}:${index}`} className="space-y-2 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <h5 className="font-medium">{segment.shiftName}</h5>
          <StatusBadge tone={tone}>{label}</StatusBadge>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs tabular-nums">
          {[
            ["Planlanan", `${segment.plannedStart}–${segment.plannedEnd}${segment.plannedEnd <= segment.plannedStart ? " (ertesi gün)" : ""}`],
            ["Gerçekleşen", segmentTimeRange([segment])],
            ["Toplam süre", formatDuration(segment.totalMinutes)],
            ["Geç giriş", formatDuration(segment.lateMinutes)],
            ["Erken çıkış", formatDuration(segment.earlyExitMinutes)],
          ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </li>;
      })}
    </ol>
    <p className="text-xs text-muted-foreground">Manuel düzeltme girişi ilk vardiyaya, çıkışı son vardiyaya uygulanır.</p>
  </section>;
}
