import { usePermissions } from "@/hooks/usePermissions";
import { DeviceActionsSection } from "./DeviceActionsSection";
import { DeviceEventsSection } from "./DeviceEventsSection";
import { DeviceDoorsSection } from "./DeviceDoorsSection";
import { DeviceQueueSection } from "./DeviceQueueSection";
import { DeviceConnectionSection } from "./DeviceConnectionSection";
import { useQuery } from "convex/react";
import { useNow } from "@/hooks/useNow";
import { deviceConnection, capabilityLabel } from "@/lib/deviceStatus";
import { errorMessage } from "@/lib/notify";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeviceCommands } from "./useDeviceCommands";
import { getAdapter, deviceDateTime } from "./deviceAdapter";
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
  const queueRows: { label: string; value: number; capped: boolean }[] =
    device.brand === "ide_smart"
      ? [
          {
            label: deviceLabels.pending,
            value: overview.queues.ideSmart.pending.count,
            capped: overview.queues.ideSmart.pending.capped,
          },
          {
            label: deviceLabels.processing,
            value: overview.queues.ideSmart.sent.count,
            capped: overview.queues.ideSmart.sent.capped,
          },
          {
            label: deviceLabels.failed,
            value: overview.queues.ideSmart.failed.count,
            capped: overview.queues.ideSmart.failed.capped,
          },
        ]
      : [
          {
            label: deviceLabels.pending,
            value: overview.queues.hikvision.pending.count,
            capped: overview.queues.hikvision.pending.capped,
          },
          {
            label: deviceLabels.processing,
            value: overview.queues.hikvision.processing.count,
            capped: overview.queues.hikvision.processing.capped,
          },
          {
            label: deviceLabels.failed,
            value: overview.queues.hikvision.failed.count,
            capped: overview.queues.hikvision.failed.capped,
          },
        ];

  const view = {
    overview,
    device,
    connection,
    connected,
    offlineMessage,
    adapter,
    queueRows,
    canManage,
    ...commands,
  };
  return (
    <div className="min-w-0 divide-y divide-line [&_button]:min-h-11 md:[&_button]:min-h-0">
      {longRunning && (
        <p role="status" className="py-3 text-sm">
          {deviceLabels.longRunning}
        </p>
      )}
      {(overview.limits?.doorsCapped || overview.limits?.readersCapped) && (
        <p role="status" className="py-3 text-sm">
          Bu cihazda gösterilenden fazla kapı/okuyucu var; liste kısaltıldı.
        </p>
      )}
      {connection === "offline" && (
        <p role="status" className="py-3 text-sm text-warning">
          {offlineMessage}
        </p>
      )}
      <DeviceConnectionSection {...view} />

      <DeviceQueueSection {...view} />

      <DeviceDoorsSection {...view} />

      <details className="min-w-0 py-5">
        <summary className="cursor-pointer text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring">
          Teknik ayrıntı
        </summary>
        <div className="min-w-0 py-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Cihaz özellikleri
          </div>
          {overview.capabilities ? (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">
                  {overview.capabilities.supported} destekli
                </Badge>
                <Badge variant="outline">
                  {overview.capabilities.unsupported} yok
                </Badge>
                <Badge variant="warning">
                  {overview.capabilities.failed} hata
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Son tarama: {deviceDateTime(overview.capabilities.updatedAt)}
                <details className="mt-2">
                  <summary>Tüm özellikler ve sorgu sonuçları</summary>
                  <ul className="space-y-1">
                    {overview.capabilities.probes.map((probe) => (
                      <li key={probe.key}>
                        {probe.label}: {capabilityLabel(probe)}
                        {!probe.ok && probe.error
                          ? ` — ${errorMessage(probe.error)}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Henüz özellik taraması yapılmadı.
            </div>
          )}
        </div>
      </details>
      <DeviceEventsSection {...view} />

      {canManage && <DeviceActionsSection {...view} />}

      <ConfirmDestructive
        open={pendingAction?.destructive === true}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title={deviceLabels.reboot}
        objectName={device.name ?? "Cihaz"}
        effects={[
          pendingAction?.description ?? "",
          ...(connection === "offline"
            ? [offlineMessage]
            : []),
        ]}
        confirmLabel={deviceLabels.reboot}
        onConfirm={runConfirmed}
      />
      <AlertDialog
        open={pendingAction !== null && !pendingAction.destructive}
        onOpenChange={(open) => {
          if (!open && !pending) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.title ?? "İşlem onayı"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.description ?? ""}{" "}
              {connection === "offline" ? offlineMessage : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
            <Button disabled={pending} onClick={runConfirmed}>
              {pending ? "İşlem sürüyor…" : "Onayla"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
