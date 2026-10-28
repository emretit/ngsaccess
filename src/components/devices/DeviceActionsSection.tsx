import {
  Activity,
  AlertCircle,
  DoorOpen,
  ListChecks,
  RefreshCw,
  RotateCw,
  ScanLine,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { deviceLabels } from "./deviceLabels";
import { ActionButton } from "./DeviceCenterMetric";
import type { DeviceCenterView } from "./deviceCenterView";
type DeviceAction = {
  key: string;
  busyKey: string;
  label: string;
  icon: ReactNode;
  supported: boolean;
  onClick: () => void;
};
export function DeviceActionsSection({
  overview,
  device,
  adapter,
  canManage,
  busy,
  handleOpenDoor,
  handleFetchReaderCfg,
  handleFetchCapabilities,
  handleFetchWorkStatus,
  handleReconcile,
  handleCaptureCard,
  handleTriggerIdeSync,
  handleReboot,
  capturedCard,
  reconcileSummary,
}: Pick<
  DeviceCenterView,
  | "overview"
  | "device"
  | "adapter"
  | "canManage"
  | "busy"
  | "handleOpenDoor"
  | "handleFetchReaderCfg"
  | "handleFetchCapabilities"
  | "handleFetchWorkStatus"
  | "handleReconcile"
  | "handleCaptureCard"
  | "handleTriggerIdeSync"
  | "handleReboot"
  | "capturedCard"
  | "reconcileSummary"
>) {
  const { can } = usePermissions();
  // Markanın hiç desteklemediği işlem düğme olarak gösterilmez.
  const deviceActions: Omit<DeviceAction, "busyKey">[] = !canManage
    ? []
    : device.brand === "hikvision"
      ? [
          {
            key: "capabilities",
            label: deviceLabels.capabilities,
            icon: <ScanLine className="h-4 w-4" />,
            supported: adapter.supported.capabilities,
            onClick: handleFetchCapabilities,
          },
          {
            key: "workStatus",
            label: deviceLabels.workStatus,
            icon: <Activity className="h-4 w-4" />,
            supported: adapter.supported.workStatus,
            onClick: handleFetchWorkStatus,
          },
          {
            key: "reconcile",
            label: deviceLabels.reconcile,
            icon: <ListChecks className="h-4 w-4" />,
            supported: adapter.supported.reconcile,
            onClick: handleReconcile,
          },
          {
            key: "captureCard",
            label: deviceLabels.captureCard,
            icon: <ScanLine className="h-4 w-4" />,
            supported: adapter.supported.capabilities,
            onClick: handleCaptureCard,
          },
          {
            key: "reboot",
            label: deviceLabels.reboot,
            icon: <RotateCw className="h-4 w-4" />,
            supported: adapter.supported.reboot,
            onClick: handleReboot,
          },
        ]
      : device.brand === "ide_smart"
        ? [
            {
              key: "triggerIdeSync",
              label: deviceLabels.triggerSync,
              icon: <RefreshCw className="h-4 w-4" />,
              supported: adapter.supported.triggerSync,
              onClick: handleTriggerIdeSync,
            },
          ]
        : [];
  const actions: DeviceAction[] = [
    ...(can("doors.open") ? overview.doors : []).map((door) => ({
      key: `openDoor:${door._id}`,
      busyKey: `openDoor:${door._id}`,
      label: `Kapıyı aç · ${door.name}`,
      icon: <DoorOpen className="h-4 w-4" />,
      supported: adapter.supported.openDoor,
      onClick: () => handleOpenDoor(door._id, door.hikDoorNo, door.name),
    })),
    ...(canManage && device.brand === "hikvision" ? overview.readers : []).map(
      (reader) => ({
        key: `readerCfg:${reader._id}`,
        busyKey: "readerCfg",
        label: `Okuyucu ayarını oku · ${reader.name}`,
        icon: <Settings2 className="h-4 w-4" />,
        supported: adapter.supported.readerCfg,
        onClick: () => handleFetchReaderCfg(reader._id),
      }),
    ),
    ...deviceActions.map((action) => ({ ...action, busyKey: action.key })),
  ];
  if (actions.length === 0 && !canManage) return null;
  return (
    <section className="min-w-0 py-3">
      <div className="mb-2 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Cihaz işlemleri</h4>
      </div>
      {actions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((action) => (
            <ActionButton
              key={action.key}
              className="w-full min-w-0 justify-start"
              busy={busy === action.busyKey}
              disabled={!action.supported || busy !== null}
              icon={action.icon}
              onClick={action.onClick}
            >
              <span className="truncate">{action.label}</span>
            </ActionButton>
          ))}
        </div>
      )}

      <div
        id="device-command-reasons"
        className="mt-2 space-y-1.5 text-sm empty:hidden"
      >
        {busy && <p>Devam eden işlemin bitmesini bekleyin.</p>}
        {capturedCard && (
          <div className="min-w-0 py-1">
            Okunan kart: <span className="font-mono">{capturedCard}</span>
          </div>
        )}
        {reconcileSummary && (
          <div className="min-w-0 py-1">Son eşitlik: {reconcileSummary}</div>
        )}
        {adapter.unsupportedReasons.map((reason) => (
          <div
            key={reason}
            className="flex items-start gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>{reason}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
