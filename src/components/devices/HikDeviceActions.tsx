import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DoorOpen, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface HikDeviceActionsProps {
  device: { _id: Id<"devices">; hikDevIndex?: string };
}

/**
 * Hikvision cihazlar için manuel test/diagnostik aksiyonları (Plan A1).
 * Kapı mekanik olarak açılıyor mu, gateway pipeline OK mı — kart pipeline'dan
 * bağımsız doğrulama. Açılırsa problem auth payload'da, açılmazsa relay/röle/network.
 */
export function HikDeviceActions({ device }: HikDeviceActionsProps) {
  const remoteOpenDoor = useAction(api.actions.hikGatewayDevice.remoteOpenDoor);
  const [opening, setOpening] = useState(false);
  const hasDevIndex = !!device.hikDevIndex;

  const handleOpen = async () => {
    setOpening(true);
    try {
      const result = await remoteOpenDoor({ deviceId: device._id });
      if (result.ok) {
        toast({ title: "Kapı açma komutu cihaza gönderildi" });
      } else {
        toast({ title: "Kapı açılamadı", description: result.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Hata", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card className="p-4 flex items-center justify-between gap-4 bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
      <div className="text-sm">
        <div className="font-medium">Cihaz Aksiyonları</div>
        <div className="text-xs text-muted-foreground">
          Tanı için: kapı mekanik & gateway bağlantısı test.
        </div>
      </div>
      <Button
        onClick={handleOpen}
        disabled={opening || !hasDevIndex}
        size="sm"
        variant="outline"
        title={!hasDevIndex ? "Önce 'Gateway'e Kaydet' tıkla" : "Kapıyı 5 sn açar"}
      >
        {opening ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <DoorOpen className="h-4 w-4 mr-2" />
        )}
        Kapıyı Aç
      </Button>
    </Card>
  );
}
