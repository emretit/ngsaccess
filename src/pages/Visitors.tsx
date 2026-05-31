import VisitorManagement from "@/components/visitors/VisitorManagement";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";

export default function Visitors() {
  return (
    <div className="space-y-3">
      <DeviceSyncStatusBanner />
      <VisitorManagement />
    </div>
  );
}
