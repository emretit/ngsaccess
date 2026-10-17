import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
type SyncResult = NonNullable<
  FunctionReturnType<typeof api.peopleActivity.employeeSyncStatus>
>;
export function EmployeeSyncSection({
  employeeId,
}: {
  employeeId: Id<"employees">;
}) {
  const result = useQuery(api.peopleActivity.employeeSyncStatus, {
    employeeId,
  });
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="text-base font-semibold">Cihaz senkron durumu</h3>
      {result === undefined ? (
        <SectionSkeleton label="Cihaz durumları yükleniyor…" />
      ) : result === null ? (
        <EmptyState compact title="Personel kaydı artık bulunamıyor." />
      ) : (
        <SyncDevices result={result} />
      )}
    </section>
  );
}
function SyncDevices({ result }: { result: SyncResult }) {
  const labels = {
    verified: "Cihazda doğrulandı",
    unknown: "Bilinmiyor",
    failed: "Başarısız",
    queued: "Bekliyor",
    processing: "İşleniyor",
  } as const;
  const tones = {
    verified: "success",
    unknown: "warning",
    failed: "danger",
    queued: "info",
    processing: "info",
  } as const;
  return (
    <>
      {result.scanTruncated && (
        <p role="status" className="text-xs text-muted-foreground">
          Durum kayıtları kısmen incelendi. Yalnız taranan kayıtlar gösterilir.
        </p>
      )}
      {result.targetsTruncated && (
        <p role="status" className="text-xs text-muted-foreground">
          Hedef cihaz listesi kısmen gösteriliyor.
        </p>
      )}
      {result.devices.length === 0 ? (
        <EmptyState
          compact
          title="Bu kişi için doğrulanmış cihaz teslim bilgisi yok."
          description="Bilinmiyor · Hedef cihaz kaydı bulunamadı."
        />
      ) : (
        <ul className="divide-y">
          {result.devices.map((row) => (
            <li key={row.device.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{row.device.name}</span>
                <StatusBadge tone={tones[row.status]}>
                  {labels[row.status]}
                </StatusBadge>
              </div>
              {row.status === "unknown" && (
                <p className="text-xs text-muted-foreground">
                  Cihaz teslim kanıtı yok.
                </p>
              )}
              {row.lastChangedAt !== null && (
                <p className="text-xs text-muted-foreground">
                  Son görülen kayıt:{" "}
                  {new Date(row.lastChangedAt).toLocaleString("tr-TR")}
                </p>
              )}
              {row.errorMessage && (
                <p className="break-words text-xs text-destructive">
                  {row.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
