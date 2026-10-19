import { todayInTurkey } from "@/lib/date";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { formatDuration } from "../lib/presentation";
export function PDKSOvertimeAlert({
  year = Number(todayInTurkey().slice(0, 4)),
}: {
  year?: number;
}) {
  const { projectId, activeProject } = useActiveProject();
  const balance = useQuery(
    api.dashboard.getAnnualOvertimeBalance,
    projectId ? { projectId, year } : "skip",
  );
  if (!projectId) return <p className="text-sm">Bir proje seçin.</p>;
  if (balance === undefined)
    return (
      <SectionSkeleton
        rows={2}
        label="Yıllık fazla mesai uyarıları yükleniyor."
      />
    );
  const warnings = balance.filter((item) => item.utilizationPct >= 80);
  return (
    <section className="space-y-2 border-y py-4">
      <h3 className="text-sm font-medium">Yıllık fazla mesai uyarıları</h3>
      <p className="text-xs text-muted-foreground">
        {year} yılı · {activeProject?.name} · Kişi ve organizasyon filtreleri
        uygulanmaz.
      </p>
      {warnings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Yıllık sınıra yaklaşan personel bulunmuyor.
        </p>
      ) : (
        <ul className="divide-y">
          {warnings.map((item) => (
            <li key={item.employeeId} className="py-2 text-xs">
              <p>
                {item.firstName} {item.lastName} · %{item.utilizationPct}
              </p>
              <p className="mt-1 text-muted-foreground tabular-nums">
                {formatDuration(item.totalOvertimeMinutes)} / {item.limitHours}{" "}
                saat
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
