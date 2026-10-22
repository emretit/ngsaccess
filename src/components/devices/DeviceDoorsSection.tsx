import { usePermissions } from "@/hooks/usePermissions";
import { DoorOpen, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deviceDateTime, formatDirection } from "./deviceAdapter";
import type { DeviceCenterView } from "./deviceCenterView";
export function DeviceDoorsSection({
  overview,
  device,
  adapter,
  connection,
  offlineMessage,
  busy,
  handleOpenDoor,
  handleFetchReaderCfg,
  canManage,
}: Pick<
  DeviceCenterView,
  | "overview"
  | "device"
  | "adapter"
  | "connection"
  | "offlineMessage"
  | "busy"
  | "handleOpenDoor"
  | "handleFetchReaderCfg"
  | "canManage"
>) {
  const { can } = usePermissions();
  return (
    <section className="min-w-0 py-5 ">
      <div className="mb-3 flex items-center gap-2">
        <DoorOpen className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Kapılar ve okuyucular</h4>
      </div>
      <p id="device-door-reasons" className="text-xs text-muted-foreground">
        {busy
          ? "Devam eden işlemin bitmesini bekleyin."
          : !adapter.supported.openDoor
            ? "Kapı açma için geçerli bir cihaz bağlantısı ve kapı eşlemesi gerekir."
            : ""}{" "}
        {connection === "offline" ? offlineMessage : ""}
      </p>
      {canManage && (
        <p id="device-reader-reasons" className="text-xs text-muted-foreground">
          {busy
            ? "Devam eden işlemin bitmesini bekleyin."
            : !adapter.supported.readerCfg
              ? "Bu bağlantı yöntemi okuyucu ayarını okumayı desteklemiyor."
              : ""}
        </p>
      )}
      <div className="space-y-3">
        {overview.doors.map((door) => {
          const doorReaders = overview.readers.filter(
            (reader) => reader.doorId === door._id,
          );
          return (
            <div key={door._id} className="min-w-0 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{door.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {device.brand === "ide_smart"
                      ? `ioId ${door.ioId ?? "-"} · Sensör ${door.requireSensor ? "zorunlu" : "zorunlu değil"}`
                      : door.hikDoorNo != null
                        ? `Hik kapı kanalı #${door.hikDoorNo}`
                        : ""}
                  </div>
                  {door.latestReading && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Son okuma: {door.latestReading.cardNo} ·{" "}
                      {deviceDateTime(door.latestReading.accessTime)}
                    </div>
                  )}
                </div>
                {can("doors.open") && <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-describedby="device-door-reasons"
                  title={connection === "offline" ? offlineMessage : undefined}
                  disabled={!adapter.supported.openDoor || busy !== null}
                  onClick={() =>
                    handleOpenDoor(door._id, door.hikDoorNo, door.name)
                  }
                >
                  {busy === `openDoor:${door._id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <DoorOpen className="h-4 w-4" />
                  )}
                  Aç
                </Button>}
              </div>

              {doorReaders.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {doorReaders.map((reader) => (
                    <div
                      key={reader._id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background p-2 text-sm"
                    >
                      <div>
                        {reader.name !== door.name && (
                          <span className="font-medium">{reader.name} · </span>
                        )}
                        <span className="text-muted-foreground">
                          {formatDirection(reader.direction)}
                        </span>
                        {device.brand === "hikvision" && (
                          <span className="text-muted-foreground">
                            {reader.hikReaderNo != null &&
                              ` · Hik okuyucu kanalı #${reader.hikReaderNo}`}
                            {reader.hikCardReaderPlanTemplateNo != null &&
                              ` · Plan ${reader.hikCardReaderPlanTemplateNo}`}
                            {reader.hikCardReaderAntiSneakEnabled != null &&
                              ` · APB ${reader.hikCardReaderAntiSneakEnabled ? "açık" : "kapalı"}`}
                          </span>
                        )}
                      </div>
                      {canManage && device.brand === "hikvision" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-describedby="device-reader-reasons"
                          title={
                            !adapter.supported.readerCfg
                              ? "Bu bağlantı yöntemi okuyucu ayarını okumayı desteklemiyor."
                              : busy !== null
                                ? "Devam eden işlemin bitmesini bekleyin."
                                : undefined
                          }
                          disabled={
                            !adapter.supported.readerCfg || busy !== null
                          }
                          onClick={() => handleFetchReaderCfg(reader._id)}
                        >
                          {busy === "readerCfg" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Settings2 className="h-4 w-4" />
                          )}
                          Okuyucu ayarını oku
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {overview.doors.length === 0 && (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Bu cihaza bağlı kapı yok.
          </div>
        )}
      </div>
    </section>
  );
}
