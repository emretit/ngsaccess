import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ServerDevice } from "@/types/device";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
export function DeviceGatewayDanger({ device, onPendingChange }: {
  device: ServerDevice;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const remove = useAction(
    api.actions.hikGatewayDevice.removeDeviceFromGateway,
  );
  return (
    <section className="border-t border-destructive/30 pt-4">
      <h3 className="mb-2 font-medium text-destructive">Tehlikeli bölge</h3>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Gateway bağlantısını kaldır
      </Button>
      <ConfirmDestructive
        open={open}
        onOpenChange={setOpen}
        title="Gateway bağlantısını kaldır"
        objectName={device.name ?? "Cihaz"}
        effects={[
          "Cihaz gateway üzerinden bağlanamaz; komutlar ve olay alımı durabilir.",
        ]}
        confirmLabel="Bağlantıyı kaldır"
        onConfirm={async () => {
          onPendingChange?.(true);
          try {
            const result = await remove({ deviceId: device._id });
            if (!result.ok)
              throw new Error(result.error ?? "Gateway bağlantısı kaldırılamadı");
            notify.success("Gateway bağlantısı kaldırıldı");
          } finally {
            onPendingChange?.(false);
          }
        }}
      />
    </section>
  );
}
