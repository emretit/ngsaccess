import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { notify } from "@/lib/notify";
import { deviceLastSignal } from "@/lib/deviceStatus";
import { deviceDateTime } from "./deviceAdapter";
import { Metric } from "./DeviceCenterMetric";
import type { DeviceCenterView } from "./deviceCenterView";
export function DeviceConnectionSection({
  overview,
  adapter,
  connected,
  connection,
}: Pick<
  DeviceCenterView,
  "overview" | "adapter" | "connected" | "connection"
>) {
  const lastSignal = deviceDateTime(deviceLastSignal(overview.device));
  return (
    <section className="min-w-0 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">Bağlantı</h3>
            <Badge variant="outline">{adapter.label}</Badge>
            <Badge variant="secondary">{adapter.transport}</Badge>
          </div>
          {overview.device.deviceIp && (
            <p className="break-all text-sm text-muted-foreground">
              {overview.device.deviceIp}
            </p>
          )}
        </div>
        <StatusBadge
          tone={
            connected
              ? "success"
              : connection === "offline"
                ? "warning"
                : "neutral"
          }
        >
          {connected
            ? "Çevrimiçi"
            : connection === "never"
              ? "Henüz bağlanmadı"
              : "Çevrimdışı"}
        </StatusBadge>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3">
        <Metric
          label="Son sinyal"
          value={lastSignal === "—" ? "Henüz sinyal alınmadı" : lastSignal}
        />
        <Metric
          label="Kapı ve okuyucu"
          value={`${overview.doors.length} kapı · ${overview.readers.length} okuyucu`}
        />
        <Metric
          label="Model"
          value={overview.device.hikModel ?? "Belirtilmedi"}
        />
        <div className="flex min-w-0 items-start gap-2">
          <div id="device-identity" className="min-w-0 flex-1">
            <Metric
              label="Kimlik"
              value={
                overview.device.ideUuid ??
                overview.device.deviceSerial ??
                "Belirtilmedi"
              }
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cihaz kimliğini kopyala"
            aria-describedby="device-identity"
            disabled={
              !(overview.device.ideUuid || overview.device.deviceSerial)
            }
            onClick={async () => {
              const identity =
                overview.device.ideUuid || overview.device.deviceSerial;
              if (!identity) return;
              try {
                await navigator.clipboard.writeText(identity);
                notify.success("Cihaz kimliği kopyalandı");
              } catch (error: unknown) {
                notify.error("Cihaz kimliği kopyalanamadı", error);
              }
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
