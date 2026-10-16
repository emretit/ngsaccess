import VisitorManagement from "@/components/visitors/VisitorManagement";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";

export default function Visitors() {
  return (
    <div className="space-y-3">
      <div id="visitor-sync-status" tabIndex={-1} aria-label="Proje cihaz senkronizasyon durumu"><DeviceSyncStatusBanner /></div>
      <VisitorManagement />
    </div>
  );
}
