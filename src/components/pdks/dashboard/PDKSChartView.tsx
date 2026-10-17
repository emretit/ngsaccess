import { analyzePdksRows } from "../lib/analysis";
import {
  formatDuration,
  readableDate,
  type PdksRow,
} from "../lib/presentation";
import { STATUS_META } from "../statusMeta";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
export function PDKSChartView({
  records,
  scope,
}: {
  records: PdksRow[];
  scope: string;
}) {
  const days = analyzePdksRows(records);
  const data = days.map((d) => ({
    date: d.date.slice(5).split("-").reverse().join("."),
    ...d.counts,
  }));
  return (
    <section className="min-w-0 space-y-5">
      <div>
        <h2 className="text-base font-semibold">Dönem analizi</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {scope} · {records.length} gösterilen personel
        </p>
      </div>
      <div
        className="h-64 min-w-0"
        role="img"
        aria-label="Seçili dönem ve filtrelerde günlük durum dağılımı; sayısal karşılıkları aşağıdaki gün listesinde."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {(["present", "late", "absent", "leave"] as const).map((status) => (
              <Bar
                key={status}
                dataKey={status}
                name={STATUS_META[status].label}
                stackId="status"
                fill={`hsl(var(--${STATUS_META[status].tone}))`}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="divide-y border-y">
        {days.map((day) => (
          <li className="py-3" key={day.date}>
            <h3 className="text-sm font-medium">{readableDate(day.date)}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {Object.entries(day.counts)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => {
                  const meta = STATUS_META[key as keyof typeof STATUS_META];
                  return (
                    <StatusBadge key={key} tone={meta.tone}>
                      {meta.label} {count}
                    </StatusBadge>
                  );
                })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              Toplam {formatDuration(day.totalMinutes)} · Geç kalma{" "}
              {formatDuration(day.lateMinutes)} · Fazla mesai{" "}
              {formatDuration(day.overtimeMinutes)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
