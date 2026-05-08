import { useMemo } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TableRow = FunctionReturnType<typeof api.cardReadings.getPdksTableData>[number];
type DayCell = NonNullable<TableRow["days"]>[number];

interface PDKSHeatmapViewProps {
  records: TableRow[];
  loading: boolean;
  startDate: string;
  endDate: string;
  onCellClick?: (employeeId: string, date: string) => void;
}

const STATUS_STYLES: Record<DayCell["status"], { bg: string; label: string }> = {
  present: { bg: "bg-green-500", label: "Mevcut" },
  late: { bg: "bg-yellow-500", label: "Geç" },
  absent: { bg: "bg-red-500", label: "Devamsız" },
  leave: { bg: "bg-blue-500", label: "İzinli" },
  weekend: { bg: "bg-muted-foreground/20", label: "Hafta sonu" },
  holiday: { bg: "bg-muted-foreground/30", label: "Tatil" },
};

const LEGEND: Array<{ status: DayCell["status"]; }> = [
  { status: "present" },
  { status: "late" },
  { status: "absent" },
  { status: "leave" },
  { status: "weekend" },
  { status: "holiday" },
];

function buildDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00.000Z`);
  const stop = new Date(`${end}T00:00:00.000Z`);
  while (cur <= stop) {
    out.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function PDKSHeatmapView({
  records,
  loading,
  startDate,
  endDate,
  onCellClick,
}: PDKSHeatmapViewProps) {
  const dates = useMemo(() => buildDateRange(startDate, endDate), [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Bu kriterlerde kayıt bulunamadı.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-3">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {LEGEND.map((l) => (
            <div key={l.status} className="flex items-center gap-1.5">
              <span className={cn("h-3 w-3 rounded", STATUS_STYLES[l.status].bg)} />
              {STATUS_STYLES[l.status].label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="min-w-max">
            {/* Header */}
            <div
              className="grid bg-muted/50 sticky top-0 z-10"
              style={{
                gridTemplateColumns: `220px repeat(${dates.length}, 32px)`,
              }}
            >
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-r border-border">
                Çalışan
              </div>
              {dates.map((d) => {
                const date = new Date(`${d}T00:00:00.000Z`);
                return (
                  <div
                    key={d}
                    className="text-center text-[10px] py-2 border-r border-border last:border-r-0 leading-tight"
                  >
                    <div className="font-medium">{format(date, "dd", { locale: tr })}</div>
                    <div className="text-muted-foreground">
                      {format(date, "EEEEE", { locale: tr })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            {records.map((row) => {
              const dayMap = new Map<string, DayCell>();
              for (const d of row.days ?? []) dayMap.set(d.date, d);
              return (
                <div
                  key={row.id}
                  className="grid border-t border-border hover:bg-muted/20"
                  style={{
                    gridTemplateColumns: `220px repeat(${dates.length}, 32px)`,
                  }}
                >
                  <div className="px-3 py-1.5 border-r border-border flex flex-col justify-center">
                    <div className="text-sm font-medium truncate">{row.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {row.department}
                    </div>
                  </div>
                  {dates.map((d) => {
                    const cell = dayMap.get(d);
                    const style = cell ? STATUS_STYLES[cell.status] : STATUS_STYLES.absent;
                    const overtime = cell && cell.overtimeMinutes > 0;
                    return (
                      <Tooltip key={d}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onCellClick?.(row.id, d)}
                            className={cn(
                              "h-7 m-0.5 rounded transition-all hover:ring-2 hover:ring-foreground/40 cursor-pointer relative",
                              style.bg
                            )}
                          >
                            {overtime && (
                              <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-purple-600 ring-1 ring-card" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-semibold">
                            {format(new Date(`${d}T00:00:00.000Z`), "dd MMMM yyyy EEEE", { locale: tr })}
                          </div>
                          <div className="mt-1 space-y-0.5">
                            <div>Durum: {style.label}</div>
                            {cell?.firstEntry && <div>İlk giriş: {cell.firstEntry}</div>}
                            {cell?.lastExit && <div>Son çıkış: {cell.lastExit}</div>}
                            {cell && cell.totalMinutes > 0 && (
                              <div>
                                Toplam: {Math.floor(cell.totalMinutes / 60)}h{" "}
                                {cell.totalMinutes % 60}m
                              </div>
                            )}
                            {cell && cell.lateMinutes > 0 && (
                              <div className="text-yellow-600">
                                Geç: {cell.lateMinutes}dk
                              </div>
                            )}
                            {cell && cell.overtimeMinutes > 0 && (
                              <div className="text-purple-600">
                                Mesai: {cell.overtimeMinutes}dk
                              </div>
                            )}
                            {cell?.payrollCode && cell.payrollCode !== "—" && (
                              <div>Bordro: {cell.payrollCode}</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
