import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDeviceSyncing } from "@/hooks/access-rules/deviceSyncStore";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useNow } from "@/hooks/useNow";
import { formatTrDateTime } from "@/lib/date";

const DAY_MS = 24 * 60 * 60 * 1000;
const VERIFIED_HINT = "Türkiye saati; yeni gönderimin sonucu değildir.";
const relativeFormat = new Intl.RelativeTimeFormat("tr-TR");

function verifiedAge(elapsed: number): string {
  const days = Math.floor(elapsed / DAY_MS);
  const [amount, unit] = days >= 365
    ? [Math.floor(days / 365), "year"] as const
    : days >= 30
      ? [Math.floor(days / 30), "month"] as const
      : [days, "day"] as const;
  return relativeFormat.format(-amount, unit);
}

/** hideVerified: cihaz odaklı olmayan sayfalarda son doğrulama tarihini gösterme (06-D2). */
export function DeviceSyncStatusBanner({ hideVerified = false }: { hideVerified?: boolean } = {}) {
  const { projectId, loading } = useActiveProjectScope();
  const status = useQuery(
    api.syncStatus.deviceSyncStatus,
    !loading && projectId ? { projectId } : "skip",
  );
  const clientSyncing = useDeviceSyncing();
  const now = useNow(60_000);
  if (!status) return null;
  const verifiedElapsed = status.lastVerifiedAt === null ? 0 : now - status.lastVerifiedAt;
  const stale = verifiedElapsed > 7 * DAY_MS;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-w-0 flex-wrap items-center gap-2 border-y border-line py-3 text-xs"
    >
      <span className="font-medium">Proje cihaz durumu</span>
      {status.failed > 0 ? (
        <StatusBadge tone="danger">
          {status.hasMore ? "En az " : ""}
          {status.failed} başarısız işlem
          {status.dismissedFailed > 0
            ? ` (${status.dismissedFailed} kapatılmış)`
            : ""}
        </StatusBadge>
      ) : status.inFlight > 0 || clientSyncing ? (
        <StatusBadge tone="info">
          Senkronizasyon kuyruğu işleniyor ({status.inFlight} işlem)
        </StatusBadge>
      ) : status.unknown ? (
        <StatusBadge tone="warning">
          Senkron durumu bilinmiyor — tarama tamamlanamadı
        </StatusBadge>
      ) : (
        <StatusBadge tone="neutral">Bekleyen işlem yok</StatusBadge>
      )}
      {status.unknown && (status.failed > 0 || status.inFlight > 0) && (
        <span className="text-xs text-muted-foreground">
          Eksik tarama; toplam durum bilinmiyor.
        </span>
      )}
      {!hideVerified && status.upToDate && status.lastVerifiedAt !== null && (
        stale ? (
          <StatusBadge tone="warning" title={VERIFIED_HINT}>
            Son doğrulanan cihaz senkronu: {formatTrDateTime(status.lastVerifiedAt)}
            {" · "}{verifiedAge(verifiedElapsed)}
          </StatusBadge>
        ) : (
          <span className="text-xs text-muted-foreground" title={VERIFIED_HINT}>
            Son doğrulanan cihaz senkronu: {formatTrDateTime(status.lastVerifiedAt)}
          </span>
        )
      )}
    </div>
  );
}
