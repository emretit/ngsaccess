import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";

/** Cihaz listesinden sadece kullandığımız alanlar */
type DeviceInfo = {
  _id: Id<"devices">;
  brand?: string;
  hikTransport?: string;
};

/** Kapı prop tipi — doors tablosunun kullandığımız alanları */
export type DoorForEdit = {
  _id: Id<"doors">;
  name: string;
  doorCode?: string;
  hikDoorNo?: number;
  hikDoorStatusPlan?: {
    enabled: boolean;
    beginTime: string;
    endTime: string;
    mode: "remainOpen" | "normal";
  };
  hikVerifyPlan?: {
    enabled: boolean;
    beginTime: string;
    endTime: string;
    verifyMode: string;
  };
};

interface EditDoorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  door: DoorForEdit;
  device: DeviceInfo | undefined;
}

// hikDoorStatusPlan form state tipi — schema shape ile birebir
type DoorStatusPlanState = {
  enabled: boolean;
  beginTime: string;
  endTime: string;
  mode: "remainOpen" | "normal";
};

// hikVerifyPlan form state tipi — schema shape ile birebir
type VerifyPlanState = {
  enabled: boolean;
  beginTime: string;
  endTime: string;
  verifyMode: string;
};

const VERIFY_MODES: { value: string; label: string }[] = [
  { value: "card", label: "Kart" },
  { value: "face", label: "Yüz" },
  { value: "fp", label: "Parmak İzi" },
  { value: "cardOrFace", label: "Kart veya Yüz" },
  { value: "cardAndPw", label: "Kart + Şifre" },
  { value: "cardAndFace", label: "Kart + Yüz" },
];

const DEFAULT_STATUS_PLAN: DoorStatusPlanState = {
  enabled: false,
  beginTime: "08:00:00",
  endTime: "18:00:00",
  mode: "remainOpen",
};

const DEFAULT_VERIFY_PLAN: VerifyPlanState = {
  enabled: false,
  beginTime: "08:00:00",
  endTime: "18:00:00",
  verifyMode: "card",
};

function isHikGateway(device: DeviceInfo | undefined): boolean {
  return device?.brand === "hikvision" && device?.hikTransport === "gateway";
}

type ApplyResult = FunctionReturnType<
  typeof api.actions.hikGatewayDevice.applyDoorStatusPlan
>;

export function EditDoorDialog({
  open,
  onOpenChange,
  onSuccess,
  door,
  device,
}: EditDoorDialogProps) {
  const [name, setName] = useState(door.name);
  const [doorCode, setDoorCode] = useState(door.doorCode ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // hikDoorNo — zorunlu sayı (1..N) yalnız gateway cihazda gösterilir
  const [hikDoorNo, setHikDoorNo] = useState<string>(
    door.hikDoorNo !== undefined ? String(door.hikDoorNo) : ""
  );

  const [statusPlan, setStatusPlan] = useState<DoorStatusPlanState>(
    door.hikDoorStatusPlan
      ? {
          enabled: door.hikDoorStatusPlan.enabled,
          beginTime: door.hikDoorStatusPlan.beginTime,
          endTime: door.hikDoorStatusPlan.endTime,
          mode: door.hikDoorStatusPlan.mode,
        }
      : DEFAULT_STATUS_PLAN
  );

  const [verifyPlan, setVerifyPlan] = useState<VerifyPlanState>(
    door.hikVerifyPlan
      ? {
          enabled: door.hikVerifyPlan.enabled,
          beginTime: door.hikVerifyPlan.beginTime,
          endTime: door.hikVerifyPlan.endTime,
          verifyMode: door.hikVerifyPlan.verifyMode,
        }
      : DEFAULT_VERIFY_PLAN
  );

  const updateDoor = useMutation(api.doors.update);
  const applyDoorStatusPlan = useAction(
    api.actions.hikGatewayDevice.applyDoorStatusPlan
  );
  const applyVerifyPlan = useAction(
    api.actions.hikGatewayDevice.applyVerifyPlan
  );

  const showHikSection = isHikGateway(device);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Kapı adı gereklidir.",
      });
      return;
    }

    const parsedDoorNo = hikDoorNo.trim() !== "" ? Number(hikDoorNo) : undefined;

    if (showHikSection) {
      if (parsedDoorNo === undefined || isNaN(parsedDoorNo) || parsedDoorNo < 1) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Hikvision kapı numarası (1 veya üzeri) girilmelidir.",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateDoor({
        doorId: door._id,
        name: name.trim(),
        doorCode: doorCode.trim() || undefined,
        hikDoorNo: parsedDoorNo,
        hikDoorStatusPlan: showHikSection ? statusPlan : undefined,
        hikVerifyPlan: showHikSection ? verifyPlan : undefined,
      });

      // Gateway cihazsa planları cihaza uygula
      if (showHikSection && parsedDoorNo !== undefined) {
        const [statusResult, verifyResult] = await Promise.all([
          applyDoorStatusPlan({ doorId: door._id }).catch(
            (err: unknown): ApplyResult => ({
              ok: false,
              error: err instanceof Error ? err.message : "Bilinmeyen hata",
            })
          ),
          applyVerifyPlan({ doorId: door._id }).catch(
            (err: unknown): ApplyResult => ({
              ok: false,
              error: err instanceof Error ? err.message : "Bilinmeyen hata",
            })
          ),
        ]);

        if (!statusResult.ok || !verifyResult.ok) {
          const errParts: string[] = [];
          if (!statusResult.ok)
            errParts.push(`Durum planı: ${statusResult.error ?? "hata"}`);
          if (!verifyResult.ok)
            errParts.push(`Doğrulama planı: ${verifyResult.error ?? "hata"}`);
          toast({
            variant: "destructive",
            title: "Plan uygulanamadı",
            description: errParts.join(" / "),
          });
        } else {
          toast({
            title: "Kaydedildi",
            description: "Kapı ve Hikvision zaman planları güncellendi.",
          });
        }
      } else {
        toast({ title: "Kaydedildi", description: "Kapı güncellendi." });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Hata",
        description:
          (error as Error)?.message ?? "Kapı güncellenirken hata oluştu.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kapıyı Düzenle</DialogTitle>
          <DialogDescription>
            {door.name} kapısının ayarlarını güncelleyin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Temel alanlar */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-door-name" className="text-right">
                Ad *
              </Label>
              <Input
                id="edit-door-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="Kapı adı"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-door-code" className="text-right">
                Kapı Kodu
              </Label>
              <Input
                id="edit-door-code"
                value={doorCode}
                onChange={(e) => setDoorCode(e.target.value)}
                className="col-span-3"
                placeholder="Kapı kodu (opsiyonel)"
              />
            </div>

            {/* Hikvision gateway bölümü */}
            {showHikSection && (
              <>
                <Separator />
                <p className="text-sm font-medium text-muted-foreground">
                  Hikvision Zaman Planı
                </p>

                {/* hikDoorNo */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="hik-door-no" className="text-right">
                    Kapı No *
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="hik-door-no"
                      type="number"
                      min={1}
                      value={hikDoorNo}
                      onChange={(e) => setHikDoorNo(e.target.value)}
                      placeholder="Cihazdaki fiziksel kapı no (1, 2, ...)"
                      required
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cihazda bu kapıya atanan fiziksel numara (1'den başlar).
                    </p>
                  </div>
                </div>

                {/* Kapı Durum Planı */}
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Kapı Durum Planı</p>
                    <Switch
                      checked={statusPlan.enabled}
                      onCheckedChange={(checked) =>
                        setStatusPlan((p) => ({ ...p, enabled: checked }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Başlangıç</Label>
                      <Input
                        type="time"
                        step={1}
                        value={statusPlan.beginTime.slice(0, 5)}
                        onChange={(e) =>
                          setStatusPlan((p) => ({
                            ...p,
                            beginTime: e.target.value + ":00",
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bitiş</Label>
                      <Input
                        type="time"
                        step={1}
                        value={statusPlan.endTime.slice(0, 5)}
                        onChange={(e) =>
                          setStatusPlan((p) => ({
                            ...p,
                            endTime: e.target.value + ":00",
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mod</Label>
                    <Select
                      value={statusPlan.mode}
                      onValueChange={(v) =>
                        setStatusPlan((p) => ({
                          ...p,
                          mode: v as "remainOpen" | "normal",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remainOpen">Sürekli Açık</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Doğrulama Modu Planı */}
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Doğrulama Modu Planı</p>
                    <Switch
                      checked={verifyPlan.enabled}
                      onCheckedChange={(checked) =>
                        setVerifyPlan((p) => ({ ...p, enabled: checked }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Başlangıç</Label>
                      <Input
                        type="time"
                        step={1}
                        value={verifyPlan.beginTime.slice(0, 5)}
                        onChange={(e) =>
                          setVerifyPlan((p) => ({
                            ...p,
                            beginTime: e.target.value + ":00",
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bitiş</Label>
                      <Input
                        type="time"
                        step={1}
                        value={verifyPlan.endTime.slice(0, 5)}
                        onChange={(e) =>
                          setVerifyPlan((p) => ({
                            ...p,
                            endTime: e.target.value + ":00",
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Doğrulama Modu</Label>
                    <Select
                      value={verifyPlan.verifyMode}
                      onValueChange={(v) =>
                        setVerifyPlan((p) => ({ ...p, verifyMode: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VERIFY_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
