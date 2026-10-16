import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useDeviceSyncing } from "@/hooks/access-rules/deviceSyncStore";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { StatusBadge } from "@/components/shared/StatusBadge";

export function DeviceSyncStatusBanner() {
  const { projectId, loading } = useActiveProjectScope();
  const status = useQuery(api.syncStatus.deviceSyncStatus, !loading && projectId ? { projectId } : "skip");
  const clientSyncing = useDeviceSyncing();
  if (!status) return null;
  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm">
      {status.failed > 0 ? (
        <StatusBadge tone="danger">
          {status.hasMore ? "En az " : ""}{status.failed} başarısız işlem
          {status.dismissedFailed > 0 ? ` (${status.dismissedFailed} kapatılmış)` : ""}
        </StatusBadge>
      ) : status.inFlight > 0 || clientSyncing ? (
        <StatusBadge tone="info">Senkronizasyon kuyruğu işleniyor ({status.inFlight} işlem)</StatusBadge>
      ) : status.unknown ? (
        <StatusBadge tone="warning">Senkron durumu bilinmiyor — tarama tamamlanamadı</StatusBadge>
      ) : <StatusBadge tone="neutral">Bekleyen işlem yok</StatusBadge>}
      {status.unknown && (status.failed > 0 || status.inFlight > 0) && (
        <span className="text-xs text-muted-foreground">Eksik tarama; toplam durum bilinmiyor.</span>
      )}
      {status.upToDate && status.lastVerifiedAt !== null && (
        <span className="text-xs text-muted-foreground">
          Doğrulanmış cihaz onayı: {new Intl.DateTimeFormat("tr-TR", {
            timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short",
          }).format(status.lastVerifiedAt)} (TR saati)
        </span>
      )}
    </div>
  );
}
