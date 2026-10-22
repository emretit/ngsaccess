import { DoorGeneralFields } from "./door-dialog/DoorGeneralFields";
import { DoorGatewayNumberField } from "./door-dialog/DoorGatewayNumberField";
import { DoorStatusPlanSection } from "./door-dialog/DoorStatusPlanSection";
import { DoorVerifyPlanSection, type VerifyPlanState } from "./door-dialog/DoorVerifyPlanSection";
import { DoorSaveResults } from "./door-dialog/DoorSaveResults";
import { DoorStatusPlanEditor } from "./DoorStatusPlanEditor";
import { normalizeDoorStatusPlan, type DoorStatusPlan } from "../../../convex/lib/doorStatusPlan";
import { useProjectAccess } from "@/hooks/useProjectAccess";
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
import { Separator } from "@/components/ui/separator";
import { errorMessage, notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
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
  hikDoorStatusPlan?: DoorStatusPlan;
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
type DoorStatusPlanState = DoorStatusPlan;

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
    door.hikDoorStatusPlan ?? DEFAULT_STATUS_PLAN
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

  const { isAdmin } = useProjectAccess();
  const showHikSection = isAdmin && isHikGateway(device);

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
      hikDoorStatusPlan: showHikSection ? normalizeDoorStatusPlan(statusPlan) : undefined,
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

  const guard = useUnsavedChangesGuard(open && (!saved && (name !== door.name || doorCode !== (door.doorCode ?? "") || hikDoorNo !== (door.hikDoorNo !== undefined ? String(door.hikDoorNo) : "") || JSON.stringify(statusPlan) !== JSON.stringify(door.hikDoorStatusPlan ?? DEFAULT_STATUS_PLAN) || JSON.stringify(verifyPlan) !== JSON.stringify(door.hikVerifyPlan ? { ...door.hikVerifyPlan, beginTime: door.hikVerifyPlan.beginTime.slice(0, 5), endTime: door.hikVerifyPlan.endTime.slice(0, 5) } : DEFAULT_VERIFY_PLAN))));
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
      try { normalizeDoorStatusPlan(statusPlan); } catch (error: unknown) { errors["status-plan"] = errorMessage(error); }
      for (const [key, plan] of [["verify", verifyPlan]] as const) {
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
              <DoorGeneralFields name={name} setName={setName} doorCode={doorCode} setDoorCode={setDoorCode} timeErrors={timeErrors} />

              {/* Hikvision gateway bölümü */}
              {showHikSection && (
                <>
                  <Separator />
                  <p className="text-sm font-medium text-muted-foreground">
                    Hikvision Zaman Planı
                  </p>

                  <DoorGatewayNumberField hikDoorNo={hikDoorNo} setHikDoorNo={setHikDoorNo} timeErrors={timeErrors} />

                  <DoorStatusPlanSection statusPlan={statusPlan} setStatusPlan={setStatusPlan} isSubmitting={isSubmitting} saved={saved}>
                    <div id="status-plan" tabIndex={-1} role="group" aria-label="Kapı durum planı aralıkları" aria-invalid={!!timeErrors["status-plan"]} aria-describedby={timeErrors["status-plan"] ? "status-plan-error" : undefined}>
                      <DoorStatusPlanEditor value={statusPlan} onChange={setStatusPlan} />
                      {timeErrors["status-plan"] && <p id="status-plan-error" className="mt-2 text-xs text-destructive">{timeErrors["status-plan"]}</p>}
                    </div>
                  </DoorStatusPlanSection>

                  <DoorVerifyPlanSection verifyPlan={verifyPlan} setVerifyPlan={setVerifyPlan} isSubmitting={isSubmitting} saved={saved} timeErrors={timeErrors} />
                </>
              )}
            </div>

          </fieldset>
          {saved && <DoorSaveResults planResults={planResults} isSubmitting={isSubmitting} />}
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
