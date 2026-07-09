import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { useDeviceSyncing } from "@/hooks/access-rules/deviceSyncStore";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

/**
 * Kalıcı cihaz-sync durum şeridi (Kişiler + Geçiş Kontrol sayfalarının üstünde).
 * Reaktif: api.syncStatus.deviceSyncStatus'a abone; her sync (çalışan/kural) op'ları
 * pending→sent→acked aktıkça canlı güncellenir — manuel işlem gerekmez.
 *
 * Öncelik: failed > inFlight > upToDate.
 * - failed>0  → kırmızı YÜZEY üretmez (global SyncIssuesBanner zaten gösterir); sadece muted işaretçi.
 * - inFlight>0 (ya da UI-tetikli sync) → mavi "senkronize ediliyor".
 * - upToDate  → yeşil "Cihaz güncel".
 */

function SyncingStrip({ count }: { count: number | undefined }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-400"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      <span>
        Cihaz senkronizasyon kuyruğu işleniyor…
        {count !== undefined && count > 0 ? ` (${count} işlem)` : ""}
      </span>
    </div>
  );
}

export function DeviceSyncStatusBanner() {
  const { projectId, loading: projectLoading } = useActiveProject();
  const status = useQuery(
    api.syncStatus.deviceSyncStatus,
    !projectLoading && projectId ? { projectId } : "skip",
  );
  const clientSyncing = useDeviceSyncing();

  // Loading: flicker'ı önlemek için hiçbir şey çizme — ama UI-tetikli sync uçuştaysa
  // sunucu sayısı düşmeden anında "senkronize ediliyor" göster.
  if (status === undefined) {
    return clientSyncing ? <SyncingStrip count={undefined} /> : null;
  }

  // Hatalar → global kırmızı SyncIssuesBanner gösterir. Burada çift kırmızı yok;
  // sadece içerik-içi muted bir işaretçi (kullanıcı uzun listede aşağı kaydırmış olabilir).
  if (status.failed > 0) {
    return (
      <div
        role="status"
        className="flex items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>↑ {status.failed} senkronizasyon sorunu — ayrıntı yukarıdaki uyarıda.</span>
      </div>
    );
  }

  if (status.inFlight > 0 || clientSyncing) {
    return <SyncingStrip count={status.inFlight} />;
  }

  if (status.upToDate) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex w-full items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Cihaz güncel — tüm değişiklikler panellere işlendi.</span>
      </div>
    );
  }

  return null;
}
