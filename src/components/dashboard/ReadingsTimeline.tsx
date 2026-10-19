import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useDashboardActivity, useDashboardTimeline } from "@/hooks/useDashboard";
import { DashboardPanel } from "./DashboardPanel";

const chartConfig = {
  granted: { label: "İzin verildi", color: "var(--color-success)" },
  denied: { label: "Reddedildi", color: "var(--color-danger)" },
} satisfies ChartConfig;

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span aria-hidden="true" className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      {label}
      <span className="font-medium tabular-nums text-foreground">{value.toLocaleString("tr-TR")}</span>
    </span>
  );
}

/** Bugünkü kart okumalarının saatlik dağılımı; altında ortalama ilk giriş / son çıkış. */
export default function ReadingsTimeline() {
  const { timeline, loading } = useDashboardTimeline();
  const { summary, loading: summaryLoading } = useDashboardActivity();
  return (
    <DashboardPanel
      title="Kart okumaları"
      context="Bugün, saatlik"
      aside={timeline && timeline.total > 0 && (
        <>
          <LegendItem color={chartConfig.granted.color} label={chartConfig.granted.label} value={timeline.granted} />
          <LegendItem color={chartConfig.denied.color} label={chartConfig.denied.label} value={timeline.denied} />
        </>
      )}
    >
      <div className="flex-1 px-2 pt-4 min-[761px]:px-3">
        {loading ? (
          <SectionSkeleton rows={4} label="Saatlik okumalar yükleniyor" className="px-2" />
        ) : !timeline || timeline.total === 0 ? (
          <p role="status" className="grid min-h-24 place-items-center px-2 py-6 text-center text-sm text-muted-foreground">
            Bugün henüz kart okuması yok.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full" aria-label={`Bugün ${timeline.total} kart okuması, saatlik dağılım`}>
            <BarChart data={timeline.hours} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap={3}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={2} tickMargin={6} tickFormatter={(hour: number) => String(hour).padStart(2, "0")} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip
                cursor={{ fill: "var(--color-subtle)" }}
                content={<ChartTooltipContent labelFormatter={(_, payload) => {
                  const hour = Number(payload?.[0]?.payload?.hour);
                  return Number.isInteger(hour) ? `${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}` : "";
                }} />}
              />
              <Bar dataKey="granted" stackId="readings" fill="var(--color-granted)" isAnimationActive={false} />
              <Bar dataKey="denied" stackId="readings" fill="var(--color-denied)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 border-t text-xs">
        <div className="border-r px-4 py-2.5 min-[761px]:px-5">
          <dt className="text-muted-foreground">Ortalama ilk giriş</dt>
          <dd className="mt-0.5 font-[550] tabular-nums">{summaryLoading ? "—" : summary?.averageFirstEntry ?? "Henüz giriş yok"}</dd>
        </div>
        <div className="px-4 py-2.5 min-[761px]:px-5">
          <dt className="text-muted-foreground">Ortalama son çıkış</dt>
          <dd className="mt-0.5 font-[550] tabular-nums">{summaryLoading ? "—" : summary?.averageLastExit ?? "Henüz çıkış yok"}</dd>
        </div>
      </dl>
    </DashboardPanel>
  );
}
