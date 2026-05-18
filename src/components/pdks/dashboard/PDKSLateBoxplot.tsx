import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next !== undefined ? sorted[base] + rest * (next - sorted[base]) : sorted[base];
}

interface PDKSLateBoxplotProps {
  samples: number[];
}

export function PDKSLateBoxplot({ samples }: PDKSLateBoxplotProps) {
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const mean =
    sorted.length > 0
      ? Math.round((sorted.reduce((s, v) => s + v, 0) / sorted.length) * 10) / 10
      : 0;

  const width = 600;
  const height = 100;
  const pad = 40;
  const innerW = width - pad * 2;
  const range = max - min || 1;
  const x = (v: number) => pad + ((v - min) / range) * innerW;

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
          📦 Geç Gelme Dakika Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Geç gelme kaydı yok.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <Stat label="Min" value={`${Math.round(min)} dk`} />
              <Stat label="Q1" value={`${Math.round(q1)} dk`} />
              <Stat label="Medyan" value={`${Math.round(median)} dk`} />
              <Stat label="Q3" value={`${Math.round(q3)} dk`} />
              <Stat label="Max" value={`${Math.round(max)} dk`} />
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
              <line
                x1={x(min)}
                x2={x(max)}
                y1={height / 2}
                y2={height / 2}
                stroke="currentColor"
                strokeOpacity={0.3}
              />
              <line
                x1={x(min)}
                x2={x(min)}
                y1={height / 2 - 10}
                y2={height / 2 + 10}
                stroke="currentColor"
                strokeOpacity={0.5}
              />
              <line
                x1={x(max)}
                x2={x(max)}
                y1={height / 2 - 10}
                y2={height / 2 + 10}
                stroke="currentColor"
                strokeOpacity={0.5}
              />
              <rect
                x={x(q1)}
                y={height / 2 - 18}
                width={x(q3) - x(q1)}
                height={36}
                fill="#fbbf24"
                fillOpacity={0.55}
                stroke="#f59e0b"
              />
              <line
                x1={x(median)}
                x2={x(median)}
                y1={height / 2 - 18}
                y2={height / 2 + 18}
                stroke="#b45309"
                strokeWidth={2}
              />
              <text
                x={x(min)}
                y={height / 2 + 32}
                fontSize={10}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.7}
              >
                {Math.round(min)}
              </text>
              <text
                x={x(max)}
                y={height / 2 + 32}
                fontSize={10}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.7}
              >
                {Math.round(max)}
              </text>
              <text
                x={x(median)}
                y={height / 2 - 24}
                fontSize={10}
                textAnchor="middle"
                fill="currentColor"
                opacity={0.85}
              >
                med {Math.round(median)}
              </text>
            </svg>
            <p className="text-xs text-muted-foreground mt-2">
              {sorted.length} geç giriş örneği · ortalama {mean} dk
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
