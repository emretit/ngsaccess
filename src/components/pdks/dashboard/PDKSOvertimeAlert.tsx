import { useAnnualOvertime } from "@/hooks/useAnnualOvertime";
import { usePermissions } from "@/hooks/usePermissions";
import { todayInTurkey } from "@/lib/date";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { formatDuration } from "../lib/presentation";
export function PDKSOvertimeAlert({
  year = Number(todayInTurkey().slice(0, 4)),
}: {
  year?: number;
}) {
  const { can } = usePermissions();
  const { projectId, activeProject } = useActiveProject();
  const enabled = can("reports.view");
  const snapshot = useAnnualOvertime(projectId && enabled ? { projectId, year } : "skip");
  const balance = snapshot.data;
  if (snapshot.error && enabled) return <div role="alert"><p>{snapshot.error}</p><button type="button" onClick={snapshot.refresh}>Yeniden dene</button></div>;
  if (!can("reports.view")) return null;
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
      <button type="button" className="text-xs underline" onClick={snapshot.refresh}>Yenile</button>
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
