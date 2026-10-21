import {
  Activity,
  AlertCircle,
  ListChecks,
  RefreshCw,
  RotateCw,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import { deviceLabels } from "./deviceLabels";
import { ActionButton } from "./DeviceCenterMetric";
import type { DeviceCenterView } from "./deviceCenterView";
export function DeviceActionsSection({
  adapter,
  busy,
  handleFetchCapabilities,
  handleFetchWorkStatus,
  handleReconcile,
  handleBackfill,
  handleCaptureCard,
  handleTriggerIdeSync,
  handleReboot,
  capturedCard,
  reconcileSummary,
}: Pick<
  DeviceCenterView,
  | "adapter"
  | "busy"
  | "handleFetchCapabilities"
  | "handleFetchWorkStatus"
  | "handleReconcile"
  | "handleBackfill"
  | "handleCaptureCard"
  | "handleTriggerIdeSync"
  | "handleReboot"
  | "capturedCard"
  | "reconcileSummary"
>) {
  return (
    <section className="min-w-0 py-5 ">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Cihaz işlemleri</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionButton
          busy={busy === "capabilities"}
          disabled={!adapter.supported.capabilities || busy !== null}
          icon={<ScanLine className="h-4 w-4" />}
          onClick={handleFetchCapabilities}
        >
          {deviceLabels.capabilities}
        </ActionButton>
        <ActionButton
          busy={busy === "workStatus"}
          disabled={!adapter.supported.workStatus || busy !== null}
          icon={<Activity className="h-4 w-4" />}
          onClick={handleFetchWorkStatus}
        >
          {deviceLabels.workStatus}
        </ActionButton>
        <ActionButton
          busy={busy === "reconcile"}
          disabled={!adapter.supported.reconcile || busy !== null}
          icon={<ListChecks className="h-4 w-4" />}
          onClick={handleReconcile}
        >
          {deviceLabels.reconcile}
        </ActionButton>
        <ActionButton
          busy={busy === "backfillEvents"}
          disabled={!adapter.supported.capabilities || busy !== null}
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={handleBackfill}
        >
          {deviceLabels.backfillEvents}
        </ActionButton>
        <ActionButton
          busy={busy === "captureCard"}
          disabled={!adapter.supported.capabilities || busy !== null}
          icon={<ScanLine className="h-4 w-4" />}
          onClick={handleCaptureCard}
        >
          {deviceLabels.captureCard}
        </ActionButton>
        <ActionButton
          busy={busy === "triggerIdeSync"}
          disabled={!adapter.supported.triggerSync || busy !== null}
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={handleTriggerIdeSync}
        >
          {deviceLabels.triggerSync}
        </ActionButton>
        <ActionButton
          busy={busy === "reboot"}
          disabled={!adapter.supported.reboot || busy !== null}
          icon={<RotateCw className="h-4 w-4" />}
          onClick={handleReboot}
        >
          {deviceLabels.reboot}
        </ActionButton>
      </div>

      {
        <div id="device-command-reasons" className="mt-3 space-y-2 text-sm">
          {busy && <p>Devam eden işlemin bitmesini bekleyin.</p>}
          {!busy && adapter.unsupportedReasons.length === 0 && (
            <p className="text-muted-foreground">
              Bu cihaz için desteklenen işlemleri kullanabilirsiniz. Panel
              senkronu yalnız IDE Smart panellerde kullanılabilir.
            </p>
          )}
          {capturedCard && (
            <div className="min-w-0 py-2">
              Okunan kart: <span className="font-mono">{capturedCard}</span>
            </div>
          )}
          {reconcileSummary && (
            <div className="min-w-0 py-2">Son eşitlik: {reconcileSummary}</div>
          )}
          {adapter.unsupportedReasons.map((reason) => (
            <div
              key={reason}
              className="flex items-start gap-2 rounded-md border border-dashed p-2 text-muted-foreground"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      }
    </section>
  );
}
