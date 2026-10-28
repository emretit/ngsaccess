import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Download } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { ServerDevice } from "@/types/device";
import { usePermissions } from "@/hooks/usePermissions";
import { notify } from "@/lib/notify";
import { ConfirmAction } from "@/components/shared/ConfirmAction";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-picker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { todayInTurkey } from "@/lib/date";
import { historyResultText, historyScopeArgs, type DeviceHistoryResult, type HistoryScope } from "./deviceImportView";
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";

export function DeviceHistoryImportCard({
  device,
  connection,
  commandPending = false,
  onPendingChange,
}: {
  device: ServerDevice;
  connection: string;
  commandPending?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { can } = usePermissions();
  if (
    device.brand !== "hikvision" ||
    device.hikTransport !== "gateway" ||
    !device.hikDevIndex ||
    !can("devices.manage")
  )
    return null;
  return (
    <ImportCard
      device={device}
      connected={connection === "online"}
      commandPending={commandPending}
      canImport={can("employees.manage")}
      onPendingChange={onPendingChange}
    />
  );
}

function ImportCard({
  device,
  connected,
  commandPending,
  canImport,
  onPendingChange,
}: {
  device: ServerDevice;
  connected: boolean;
  commandPending: boolean;
  canImport: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const backfill = useAction(api.actions.hikGatewayDevice.backfillDeviceEvents);
  const [busy, setBusy] = useState<"history" | null>(null);
  const running = useRef(false);
  const [confirmation, setConfirmation] = useState<"all" | null>(null);
  const [historyResult, setHistoryResult] =
    useState<DeviceHistoryResult | null>(null);
  const [scope, setScope] = useState<HistoryScope>("recent");
  const [date, setDate] = useState("");
  const today = todayInTurkey();
  const disabled = !connected || busy !== null || commandPending;
  useEffect(() => {
    onPendingChange?.(busy !== null);
  }, [busy, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);

  async function fetchHistory() {
    if (
      disabled ||
      running.current ||
      (scope === "date" && (!date || date > today))
    )
      return false;
    running.current = true;
    setBusy("history");
    setHistoryResult(null);
    try {
      const result = await backfill({
        deviceId: device._id,
        ...historyScopeArgs(scope, date),
      });
      if (!result.ok && !result.partial) {
        notify.error(
          "Kayıtlar çekilemedi",
          result.error ?? "Beklenmeyen bir hata oluştu.",
        );
        return false;
      }
      setHistoryResult(result);
      setConfirmation(null);
      return true;
    } catch (error) {
      notify.error("Kayıtlar çekilemedi", errorMessage(error));
      return false;
    } finally {
      running.current = false;
      setBusy(null);
    }
  }
  return (
    <section className="min-w-0 space-y-4 py-3 [&_button]:min-h-11 md:[&_button]:min-h-0">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Download className="h-4 w-4 text-muted-foreground" />
        Geçmiş kayıtları çek
      </h4>
      {!connected && (
        <p role="status" className="text-sm text-warning">
          Cihaz çevrimdışı — aktarım yapılamaz
        </p>
      )}
      <div className="min-w-0 space-y-3">
        <ToggleGroup
          type="single"
          value={scope}
          disabled={disabled}
          className="flex flex-wrap justify-start"
          aria-label="Kayıt kapsamı"
          onValueChange={(value) => {
            if (value === "recent" || value === "date" || value === "all")
              setScope(value);
          }}
        >
          <ToggleGroupItem value="recent">Son 24 saat</ToggleGroupItem>
          <ToggleGroupItem value="date">Tarihten itibaren</ToggleGroupItem>
          <ToggleGroupItem value="all">Tümü</ToggleGroupItem>
        </ToggleGroup>
        {scope === "date" && (
          <div className="space-y-1">
            <label htmlFor={`import-date-${device._id}`} className="text-sm">
              Başlangıç tarihi
            </label>
            <DateInput
              id={`import-date-${device._id}`}
              value={date}
              onChange={setDate}
              max={today}
              disabled={disabled}
              className="w-full"
            />
          </div>
        )}
        <Button
          variant="outline"
          disabled={disabled || (scope === "date" && (!date || date > today))}
          onClick={() =>
            scope === "all" ? setConfirmation("all") : void fetchHistory()
          }
        >
          Kayıtları çek
        </Button>
        {historyResult && (
          <p role="status" className="rounded-md bg-muted p-3 text-sm">
            {historyResultText(historyResult)}
          </p>
        )}
      </div>
      {busy === "history" && (
        <p role="status" className="text-sm">
          Kayıtlar çekiliyor…
        </p>
      )}
      <ConfirmAction
        open={confirmation === "all"}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
        title="Tüm kayıtlar çekilsin mi?"
        description="Cihazdaki tüm geçmiş kayıtlar çekilecek. Zaten aktarılanlar tekrar eklenmez; işlem birkaç dakika sürebilir."
        confirmLabel="Tümünü çek"
        onConfirm={fetchHistory}
      />
      {canImport && <p className="text-sm text-muted-foreground">Kişileri aktarmak için: Kişiler → Personel ekle → Cihazdan kişileri çek</p>}
    </section>
  );
}
