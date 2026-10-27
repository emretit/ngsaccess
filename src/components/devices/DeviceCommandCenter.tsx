import { usePermissions } from "@/hooks/usePermissions";
import { DeviceActionsSection } from "./DeviceActionsSection";
import { DeviceConnectionSection } from "./DeviceConnectionSection";
import { useQuery } from "convex/react";
import { useNow } from "@/hooks/useNow";
import { deviceConnection } from "@/lib/deviceStatus";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ConfirmAction } from "@/components/shared/ConfirmAction";
import { useDeviceCommands } from "./useDeviceCommands";
import { getAdapter } from "./deviceAdapter";
import { deviceLabels } from "./deviceLabels";
import type { DeviceOverview } from "./deviceAdapter";
export function DeviceCommandCenter({
  deviceId,
  onPendingChange,
}: {
  deviceId: Id<"devices">;
  onPendingChange?: (pending: boolean) => void;
}) {
  const overview = useQuery(api.deviceCenter.getOverview, { deviceId });
  if (overview === undefined)
    return <SectionSkeleton rows={5} label="Cihaz bilgileri yükleniyor" />;
  if (!overview) return <p role="alert">Cihaz merkezi bilgisi alınamadı.</p>;
  return <DeviceCenter overview={overview} onPendingChange={onPendingChange} />;
}
function DeviceCenter({
  overview,
  onPendingChange,
}: {
  overview: DeviceOverview;
  onPendingChange?: (pending: boolean) => void;
}) {
  const device = overview.device;
  const clock = useNow(15_000);
  const { can } = usePermissions();
  const canManage = can("devices.manage");
  const commands = useDeviceCommands(device, onPendingChange);
  const {
    pending,
    pendingAction,
    setPendingAction,
    runConfirmed,
    longRunning,
  } = commands;
  const connection = deviceConnection(overview.device, clock);
  const connected = connection === "online";
  const offlineMessage =
    device.brand === "ide_smart" ||
    (device.brand === "hikvision" && device.hikTransport === "localBridge")
      ? "Cihaz çevrimdışı — komut kuyruğa alınır"
      : "Cihaz çevrimdışı — komut ulaşmayabilir";
  const hasIdeDoor = overview.doors.some(
    (door) => typeof door.ioId === "number",
  );
  const adapter = getAdapter(overview.device, hasIdeDoor);
  const view = {
    overview,
    device,
    connection,
    connected,
    offlineMessage,
    adapter,
    canManage,
    ...commands,
  };
  return (
    <div className="min-w-0 divide-y divide-line [&_button]:min-h-11 md:[&_button]:min-h-0">
      {longRunning && (
        <p role="status" className="py-2 text-sm">
          {deviceLabels.longRunning}
        </p>
      )}
      {(overview.limits?.doorsCapped || overview.limits?.readersCapped) && (
        <p role="status" className="py-2 text-sm">
          Bu cihazda gösterilenden fazla kapı/okuyucu var; liste kısaltıldı.
        </p>
      )}
      {connection === "offline" && (
        <p role="status" className="py-2 text-sm text-warning">
          {offlineMessage}
        </p>
      )}
      <DeviceConnectionSection {...view} />

      <DeviceActionsSection {...view} />

      <ConfirmDestructive
        open={pendingAction?.destructive === true}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title={deviceLabels.reboot}
        objectName={device.name ?? "Cihaz"}
        effects={[
          pendingAction?.description ?? "",
          ...(connection === "offline" ? [offlineMessage] : []),
        ]}
        confirmLabel={deviceLabels.reboot}
        onConfirm={runConfirmed}
      />
      <ConfirmAction
        open={pendingAction !== null && !pendingAction.destructive}
        onOpenChange={(open) => {
          if (!open && !pending) setPendingAction(null);
        }}
        title={pendingAction?.title ?? "İşlem onayı"}
        description={
          <>
            {pendingAction?.description ?? ""}{" "}
            {connection === "offline" ? offlineMessage : ""}
          </>
        }
        confirmLabel="Onayla"
        onConfirm={runConfirmed}
      />
    </div>
  );
}
