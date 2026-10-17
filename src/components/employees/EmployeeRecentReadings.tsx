import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
type Readings = NonNullable<
  FunctionReturnType<typeof api.peopleActivity.employeeRecentReadings>
>;
export function EmployeeRecentReadings({
  employeeId,
}: {
  employeeId: Id<"employees">;
}) {
  const result = useQuery(api.peopleActivity.employeeRecentReadings, {
    employeeId,
    limit: 10,
  });
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-base font-semibold">Son geçişler</h3>
      {result === undefined ? (
        <SectionSkeleton label="Son geçişler yükleniyor…" />
      ) : result === null ? (
        <EmptyState compact title="Personel kaydı artık bulunamıyor." />
      ) : result.length === 0 ? (
        <EmptyState compact title="Bu kişi için geçiş kaydı yok." />
      ) : (
        <ReadingsList readings={result} />
      )}
    </section>
  );
}
function ReadingsList({ readings }: { readings: Readings }) {
  return (
    <ul className="divide-y">
      {readings.map((row) => {
        const allowed = row.accessStatus === "izin_verildi";
        const denied = row.accessStatus === "reddedildi";
        return (
          <li key={row._id} className="space-y-1 py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <time dateTime={row.accessTime}>
                {new Date(row.accessTime).toLocaleString("tr-TR")}
              </time>
              <StatusBadge
                tone={allowed ? "success" : denied ? "danger" : "warning"}
              >
                {allowed
                  ? "İzin verildi"
                  : denied
                    ? "Reddedildi"
                    : "Bilinmiyor"}
              </StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">
              {row.deviceName ?? "Cihaz adı bulunamıyor"}
              {row.direction
                ? ` · ${row.direction === "entry" ? "Giriş" : "Çıkış"}`
                : ""}
            </p>
            {row.hikDenialReason && (
              <p className="text-xs text-destructive">{row.hikDenialReason}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
