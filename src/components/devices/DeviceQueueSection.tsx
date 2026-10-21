import { deviceLabels } from "./deviceLabels";
import { Activity } from "lucide-react";
import { Metric } from "./DeviceCenterMetric";
import type { DeviceCenterView } from "./deviceCenterView";
export function DeviceQueueSection({
  queueRows,
}: Pick<DeviceCenterView, "queueRows">) {
  return (
    <section className="min-w-0 py-5 ">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Komut kuyruğu</h4>
      </div>
      <div>
        <div className="min-w-0 py-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Yalnız yüklenen kuyruk kayıtları. Tamamlanan işlemler fiziksel kapı
            açılışını doğrulamaz.
          </p>
          <p role="status" className="mb-2 text-sm">
            {queueRows
              .filter(
                (row) =>
                  row.label === deviceLabels.pending ||
                  row.label === deviceLabels.processing,
              )
              .reduce((total, row) => total + row.value, 0)}
            {queueRows.some(
              (row) => row.label !== deviceLabels.failed && row.capped,
            )
              ? "+"
              : ""}{" "}
            işlem bekliyor ·{" "}
            {queueRows.find((row) => row.label === deviceLabels.failed)
              ?.value ?? 0}
            {queueRows.find((row) => row.label === deviceLabels.failed)?.capped
              ? "+"
              : ""}{" "}
            işlem başarısız
          </p>
          <div className="grid grid-cols-3 gap-2">
            {queueRows.map((row) => (
              <Metric
                key={row.label}
                label={row.label}
                value={row.capped ? "100+" : String(row.value)}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
