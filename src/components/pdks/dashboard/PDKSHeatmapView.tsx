import { PdksPlanSummary } from "./PdksPlanSummary";
import { planDayLabel, segmentTimeRange } from "../lib/presentation";
import { eachDayOfInterval, format } from "date-fns";
import { tr } from "date-fns/locale";
import { STATUS_META, IN_PROGRESS_META, statusMetaFor } from "../statusMeta";
import {
  cellLabel,
  formatDuration,
  periodTotals,
  type PdksRow,
} from "../lib/presentation";
interface Props {
  records: PdksRow[];
  loading: boolean;
  startDate: string;
  endDate: string;
  onCellClick?: (id: string, date: string) => void;
}
export function PDKSHeatmapView({
  records,
  loading,
  startDate,
  endDate,
  onCellClick,
}: Props) {
  if (loading) return <div role="status">PDKS kayıtları yükleniyor.</div>;
  const dates = eachDayOfInterval({
    start: new Date(`${startDate}T12:00:00`),
    end: new Date(`${endDate}T12:00:00`),
  }).map((d) => format(d, "yyyy-MM-dd"));
  const grid = {
    gridTemplateColumns: `minmax(0, var(--pdks-person-width)) repeat(${dates.length}, 72px) 120px`,
  };
  return (
    <div className="min-w-0 space-y-3 [--pdks-person-width:120px] sm:[--pdks-person-width:192px]">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {Object.entries(STATUS_META)
          .filter(([s]) => s !== "overtime")
          .map(([s, m]) => (
            <span key={s} className={m.textClass}>
              {m.code}: {m.label}
            </span>
          ))}
        <span className={IN_PROGRESS_META.textClass}>DE: {IN_PROGRESS_META.label}</span>
        <span className="text-muted-foreground">Süre: sa:dk</span>
      </div>
      <div
        className="max-w-full overflow-x-auto rounded-md border"
        role="region"
        tabIndex={0}
        aria-label="Puantaj; günleri görmek için yatay kaydırın"
      >
        <div className="min-w-max text-xs tabular-nums">
          <div style={grid} className="grid min-h-9 bg-muted">
            <div className="sticky left-0 z-20 flex items-center border-r bg-muted px-3 font-medium">
              Çalışan
            </div>
            {dates.map((d) => (
              <div key={d} className="border-r py-2 text-center">
                {format(new Date(`${d}T12:00:00`), "dd EEE", { locale: tr })}
              </div>
            ))}
            <div className="p-2">Toplam süre</div>
          </div>
          {records.map((row) => {
            const cells = new Map(row.days.map((d) => [d.date, d]));
            const totals = periodTotals(row.days);
            return (
              <div
                style={grid}
                key={row.id}
                className="grid min-h-[42px] border-t"
              >
                <div className="sticky left-0 z-10 border-r bg-background px-3 py-2">
                  <span className="block max-w-full break-words font-medium">
                    {row.name}
                  </span>
                  <span className="text-muted-foreground">
                    {row.department}
                  </span>
                </div>
                {dates.map((date) => {
                  const cell = cells.get(date);
                  const status = cell?.status ?? "noData";
                  const meta = statusMetaFor(cell ?? { status });
                  const planLabel = planDayLabel(cell);
                  const timeRange = cell?.segments && cell.segments.length > 1 ? segmentTimeRange(cell.segments) : undefined;
                  const duration =
                    !cell ||
                    status === "future" ||
                    status === "noData" ||
                    ([
                      "absent",
                      "leave",
                      "weekend",
                      "holiday",
                      "future",
                      "noData",
                    ].includes(status) &&
                      cell.totalMinutes === 0)
                      ? "—"
                      : formatDuration(cell.totalMinutes, true);
                  return (
                    <button
                      type="button"
                      key={date}
                      aria-label={cellLabel(row.name, date, cell)}
                      title={planLabel || undefined}
                      className={`min-h-[42px] border-r px-1 ${planLabel ? "h-[42px] overflow-hidden py-1 leading-[11px]" : "py-2"} text-center text-[11px] whitespace-nowrap hover:underline ${meta.bgClass} ${meta.textClass}`}
                      onClick={() => onCellClick?.(row.id, date)}
                    >
                      {meta.code} · {duration}
                      <PdksPlanSummary day={cell} compact />
                      {timeRange && timeRange !== "—" && <span className="block text-[10px] leading-[10px]">
                        {timeRange}
                      </span>}
                    </button>
                  );
                })}
                <div className="px-2 py-2">
                  {formatDuration(totals.totalMinutes)}
                  {totals.overtimeMinutes > 0 && (
                    <div className="mt-1 text-muted-foreground">
                      Mesai {formatDuration(totals.overtimeMinutes)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Gün hücresini seçerek ayrıntıları ve manuel düzeltmeyi açın.
      </p>
    </div>
  );
}
