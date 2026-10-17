import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
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
import { errorMessage, notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { applySelectedDoorPlans, doorPlanTimeSchema, type PlanKey, type PlanResult } from "./doorPlanResult";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
  beginTime: "08:00",
  endTime: "18:00",
  mode: "remainOpen",
};

const DEFAULT_VERIFY_PLAN: VerifyPlanState = {
  enabled: false,
  beginTime: "08:00",
  endTime: "18:00",
  verifyMode: "card",
};

function isHikGateway(device: DeviceInfo | undefined): boolean {
  return device?.brand === "hikvision" && device?.hikTransport === "gateway";
}

export function EditDoorDialog({
  open,
  onOpenChange,
  onSuccess,
  door,
  device,
}: EditDoorDialogProps) {
  const [name, setName] = useState(door.name);
  const [doorCode, setDoorCode] = useState(door.doorCode ?? "");
  const [saved, setSaved] = useState(false);
  const [planResults, setPlanResults] = useState<PlanResult[]>([]);
  const [timeErrors, setTimeErrors] = useState<Record<string, string>>({});

  // hikDoorNo — zorunlu sayı (1..N) yalnız gateway cihazda gösterilir
  const [hikDoorNo, setHikDoorNo] = useState<string>(
    door.hikDoorNo !== undefined ? String(door.hikDoorNo) : ""
  );

  const [statusPlan, setStatusPlan] = useState<DoorStatusPlanState>(
    door.hikDoorStatusPlan
      ? {
          enabled: door.hikDoorStatusPlan.enabled,
          beginTime: door.hikDoorStatusPlan.beginTime.slice(0, 5),
          endTime: door.hikDoorStatusPlan.endTime.slice(0, 5),
          mode: door.hikDoorStatusPlan.mode,
        }
      : DEFAULT_STATUS_PLAN
  );

  const [verifyPlan, setVerifyPlan] = useState<VerifyPlanState>(
    door.hikVerifyPlan
      ? {
          enabled: door.hikVerifyPlan.enabled,
          beginTime: door.hikVerifyPlan.beginTime.slice(0, 5),
          endTime: door.hikVerifyPlan.endTime.slice(0, 5),
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

  const sendPlans = async (keys: PlanKey[]) => {
    const results = await applySelectedDoorPlans(keys, {
      status: () => applyDoorStatusPlan({ doorId: door._id }),
      verify: () => applyVerifyPlan({ doorId: door._id }),
    }, errorMessage);
    setPlanResults((previous) => [
      ...previous.filter((result) => !keys.includes(result.key)),
      ...results,
    ]);
    return results.every((result) => result.ok);
  };

  const saveAction = useAsyncAction(async (parsedDoorNo: number | undefined) => {
    await updateDoor({
      doorId: door._id,
      name: name.trim(),
      doorCode: doorCode.trim() || undefined,
      hikDoorNo: parsedDoorNo,
      hikDoorStatusPlan: showHikSection ? {
        ...statusPlan,
        beginTime: `${statusPlan.beginTime}:00`,
        endTime: `${statusPlan.endTime}:00`,
      } : undefined,
      hikVerifyPlan: showHikSection ? {
        ...verifyPlan,
        beginTime: `${verifyPlan.beginTime}:00`,
        endTime: `${verifyPlan.endTime}:00`,
      } : undefined,
    });
    setSaved(true);
    if (showHikSection) {
      if (!(await sendPlans(["status", "verify"]))) return;
      notify.success("Kapı kaydedildi ve zaman planları cihaza uygulandı");
    } else {
      notify.success("Kapı kaydedildi");
    }
    onSuccess();
    onOpenChange(false);
  }, { error: "Kapı kaydedilemedi" });

  const retryAction = useAsyncAction(async () => {
    const failed = planResults.filter((result) => !result.ok).map((result) => result.key);
    if (failed.length === 0) return;
    if (await sendPlans(failed)) notify.success("Zaman planları cihaza uygulandı");
  }, { error: "Planlar gönderilemedi" });
  const isSubmitting = saveAction.pending || retryAction.pending;

  const guard = useUnsavedChangesGuard(open && (!saved && (name !== door.name || doorCode !== (door.doorCode ?? "") || hikDoorNo !== (door.hikDoorNo !== undefined ? String(door.hikDoorNo) : "") || JSON.stringify(statusPlan) !== JSON.stringify(door.hikDoorStatusPlan ? { ...door.hikDoorStatusPlan, beginTime: door.hikDoorStatusPlan.beginTime.slice(0, 5), endTime: door.hikDoorStatusPlan.endTime.slice(0, 5) } : DEFAULT_STATUS_PLAN) || JSON.stringify(verifyPlan) !== JSON.stringify(door.hikVerifyPlan ? { ...door.hikVerifyPlan, beginTime: door.hikVerifyPlan.beginTime.slice(0, 5), endTime: door.hikVerifyPlan.endTime.slice(0, 5) } : DEFAULT_VERIFY_PLAN))));
  const close = () => { if (!isSubmitting) guard.requestClose(() => onOpenChange(false)); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saved || isSubmitting) return;
    if (!name.trim()) {
      setTimeErrors({ name: "Kapı adı gereklidir." });
      document.getElementById("edit-door-name")?.focus();
      return;
    }
    const parsedDoorNo = hikDoorNo.trim() !== "" ? Number(hikDoorNo) : undefined;
    if (showHikSection && (parsedDoorNo === undefined || !Number.isInteger(parsedDoorNo) || parsedDoorNo < 1)) {
      setTimeErrors({ hikDoorNo: "Hikvision kapı numarası 1 veya üzeri bir tam sayı olmalıdır." });
      document.getElementById("hik-door-no")?.focus();
      return;
    }
    const errors: Record<string, string> = {};
    if (showHikSection) {
      for (const [key, plan] of [["status", statusPlan], ["verify", verifyPlan]] as const) {
        const result = doorPlanTimeSchema.safeParse({
          beginTime: plan.beginTime,
          endTime: plan.endTime,
        });
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors[`${key}-${String(issue.path[0])}`] = issue.message;
          }
        }
      }
    }
    setTimeErrors(errors);
    if (Object.keys(errors).length > 0) { document.getElementById(Object.keys(errors)[0])?.focus(); return; }
    await saveAction.run(parsedDoorNo);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kapıyı Düzenle</DialogTitle>
          <DialogDescription>
            {door.name} kapısının ayarlarını güncelleyin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} aria-busy={isSubmitting} noValidate>
          {Object.keys(timeErrors).length > 0 && <div role="alert" className="mb-4 text-sm text-destructive"><p className="font-medium">Kaydedilemedi. Alanları kontrol edin.</p><ul className="list-disc pl-4">{Object.entries(timeErrors).map(([key, message]) => <li key={key}>{message}</li>)}</ul></div>}
          <fieldset disabled={isSubmitting || saved}>
            <div className="grid gap-4 py-4">
              {/* Temel alanlar */}
              <div className="grid gap-2">
                <Label htmlFor="edit-door-name" >
                  Ad *
                </Label>
                <Input
                  id="edit-door-name" aria-invalid={!!timeErrors.name} aria-describedby={timeErrors.name ? "edit-door-name-error" : undefined}
                  value={name}
                  onChange={(e) => setName(e.target.value)}

                  placeholder="Kapı adı"
                  required
                />
                {timeErrors.name && <p id="edit-door-name-error" className="text-xs text-destructive">{timeErrors.name}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-door-code" >
                  Kapı Kodu
                </Label>
                <Input
                  id="edit-door-code"
                  value={doorCode}
                  onChange={(e) => setDoorCode(e.target.value)}

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
                  <div className="grid gap-2">
                    <Label htmlFor="hik-door-no" >
                      Kapı No *
                    </Label>
                    <div >
                      <Input
                        id="hik-door-no" aria-invalid={!!timeErrors.hikDoorNo} aria-describedby={timeErrors.hikDoorNo ? "edit-door-number-error" : undefined}
                        type="number"
                        min={1}
                        value={hikDoorNo}
                        onChange={(e) => setHikDoorNo(e.target.value)}
                        placeholder="Cihazdaki fiziksel kapı no (1, 2, ...)"
                        required
                      />
                      {timeErrors.hikDoorNo && <p id="edit-door-number-error" className="text-xs text-destructive">{timeErrors.hikDoorNo}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Cihazda bu kapıya atanan fiziksel numara (1'den başlar).
                      </p>
                    </div>
                  </div>

                  {/* Kapı Durum Planı */}
                  <div className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="status-enabled" className="text-sm font-medium">Kapı Durum Planı</Label>
                      <Switch
                        disabled={isSubmitting || saved}
                        id="status-enabled"
                        checked={statusPlan.enabled}
                        onCheckedChange={(checked) =>
                          setStatusPlan((p) => ({ ...p, enabled: checked }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormFieldWrapper htmlFor="status-beginTime" label="Başlangıç (TR saati)" error={timeErrors["status-beginTime"]}>
                        <Input
                          id="status-beginTime"
                          type="time"
                          step={60}
                          value={statusPlan.beginTime.slice(0, 5)}
                          onChange={(e) =>
                            setStatusPlan((p) => ({
                              ...p,
                              beginTime: e.target.value,
                            }))
                          }
                        />
                      </FormFieldWrapper>
                      <FormFieldWrapper htmlFor="status-endTime" label="Bitiş (TR saati)" error={timeErrors["status-endTime"]}>
                        <Input
                          id="status-endTime"
                          type="time"
                          step={60}
                          value={statusPlan.endTime.slice(0, 5)}
                          onChange={(e) =>
                            setStatusPlan((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                        />
                      </FormFieldWrapper>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="status-mode" className="text-xs">Mod</Label>
                      <Select
                        disabled={isSubmitting || saved}
                        value={statusPlan.mode}
                        onValueChange={(v) =>
                          setStatusPlan((p) => ({
                            ...p,
                            mode: v as "remainOpen" | "normal",
                          }))
                        }
                      >
                        <SelectTrigger id="status-mode">
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
                      <Label htmlFor="verify-enabled" className="text-sm font-medium">Doğrulama Modu Planı</Label>
                      <Switch
                        disabled={isSubmitting || saved}
                        id="verify-enabled"
                        checked={verifyPlan.enabled}
                        onCheckedChange={(checked) =>
                          setVerifyPlan((p) => ({ ...p, enabled: checked }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormFieldWrapper htmlFor="verify-beginTime" label="Başlangıç (TR saati)" error={timeErrors["verify-beginTime"]}>
                        <Input
                          id="verify-beginTime"
                          type="time"
                          step={60}
                          value={verifyPlan.beginTime.slice(0, 5)}
                          onChange={(e) =>
                            setVerifyPlan((p) => ({
                              ...p,
                              beginTime: e.target.value,
                            }))
                          }
                        />
                      </FormFieldWrapper>
                      <FormFieldWrapper htmlFor="verify-endTime" label="Bitiş (TR saati)" error={timeErrors["verify-endTime"]}>
                        <Input
                          id="verify-endTime"
                          type="time"
                          step={60}
                          value={verifyPlan.endTime.slice(0, 5)}
                          onChange={(e) =>
                            setVerifyPlan((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                        />
                      </FormFieldWrapper>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="verify-mode" className="text-xs">Doğrulama Modu</Label>
                      <Select
                        disabled={isSubmitting || saved}
                        value={verifyPlan.verifyMode}
                        onValueChange={(v) =>
                          setVerifyPlan((p) => ({ ...p, verifyMode: v }))
                        }
                      >
                        <SelectTrigger id="verify-mode">
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

          </fieldset>
          {saved && (
            <div className="mb-4 space-y-2 rounded-md border p-3" role="status" aria-live="polite">
              <StatusBadge tone="success">Kaydedildi</StatusBadge>
              <p className="text-sm">Ayarlar veritabanına kaydedildi.</p>
              {planResults.map((result) => (
                <div key={result.key} className="space-y-1">
                  <StatusBadge tone={result.ok ? "success" : "warning"}>
                    {result.key === "status" ? "Kapı durum planı" : "Doğrulama planı"}
                    {result.ok ? ": Cihaza uygulandı" : ": Cihaza uygulanamadı"}
                  </StatusBadge>
                  {!result.ok && <p className="text-sm">{result.error || "Cihazdan başarılı sonuç alınamadı; cihazdaki durum doğrulanamadı."}</p>}
                </div>
              ))}
              {isSubmitting && <p className="text-sm">Planlar cihaza gönderiliyor…</p>}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={close}
            >
              {saved ? "Kapat" : "İptal"}
            </Button>
            {saved ? (
              planResults.some((result) => !result.ok) && (
                <Button type="button" disabled={isSubmitting} onClick={() => void retryAction.run()}>
                  {isSubmitting ? "Gönderiliyor…" : "Tekrar gönder"}
                </Button>
              )
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {guard.dialog}
    </>
  );
}
