import { TemplatePicker } from "../unified/templates/TemplatePicker";
import type { Id } from "../../../../convex/_generated/dataModel";
import { DoorStatusPlanSection } from "../door-dialog/DoorStatusPlanSection";
import {
  DoorVerifyPlanSection,
  type VerifyPlanState,
} from "../door-dialog/DoorVerifyPlanSection";
import { DoorSaveResults } from "../door-dialog/DoorSaveResults";
import { DoorStatusPlanEditor } from "../DoorStatusPlanEditor";
import {
  normalizeDoorStatusPlan,
  normalizeVerifyPlan,
  type DoorStatusPlan,
} from "../../../../convex/lib/doorStatusPlan";
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
import { errorMessage, notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import {
  applySelectedDoorPlans,
  type PlanKey,
  type PlanResult,
} from "../doorPlanResult";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type DoorPlanTarget = FunctionReturnType<
  typeof api.doors.listPlanTargets
>[number];
interface DoorPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  door: DoorPlanTarget;
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

export function DoorPlanDialog({
  open,
  onOpenChange,
  onSuccess,
  door,
}: DoorPlanDialogProps) {
  const [saved, setSaved] = useState(false);
  const [planResults, setPlanResults] = useState<PlanResult[]>([]);
  const [timeErrors, setTimeErrors] = useState<Record<string, string>>({});

  const [statusPlan, setStatusPlan] = useState<DoorStatusPlanState>(
    door.hikDoorStatusPlan ?? DEFAULT_STATUS_PLAN,
  );

  const [verifyPlan, setVerifyPlan] = useState<VerifyPlanState>(
    door.hikVerifyPlan ?? DEFAULT_VERIFY_PLAN,
  );
  const [useTemplate, setUseTemplate] = useState(
    !!door.hikDoorStatusTemplateId,
  );
  const [templateId, setTemplateId] = useState<string>(
    door.hikDoorStatusTemplateId ?? "",
  );
  const [holiday, setHoliday] = useState(
    door.hikDoorHolidayPlan ?? {
      enabled: false,
      year: new Date().getFullYear(),
      mode: "remainClosed" as const,
    },
  );

  const holidayRanges = useQuery(api.doors.listPlanHolidays,
    holiday.enabled ? { projectId: door.projectId, year: holiday.year } : "skip");
  const statusChanged = JSON.stringify(statusPlan) !== JSON.stringify(door.hikDoorStatusPlan ?? DEFAULT_STATUS_PLAN) ||
    useTemplate !== !!door.hikDoorStatusTemplateId || templateId !== (door.hikDoorStatusTemplateId ?? "") ||
    (useTemplate && door.templateChanged);
  const verifyChanged = JSON.stringify(verifyPlan) !== JSON.stringify(door.hikVerifyPlan ?? DEFAULT_VERIFY_PLAN);
  const holidayChanged = JSON.stringify(holiday) !== JSON.stringify(door.hikDoorHolidayPlan ?? {
    enabled: false, year: new Date().getFullYear(), mode: "remainClosed",
  });

  const updateDoor = useMutation(api.doors.updatePlans);
  const applyDoorStatusPlan = useAction(
    api.actions.hikGatewayDevice.applyDoorStatusPlan,
  );
  const applyVerifyPlan = useAction(
    api.actions.hikGatewayDevice.applyVerifyPlan,
  );

  const sendPlans = async (keys: PlanKey[]) => {
    const results = await applySelectedDoorPlans(
      keys,
      {
        status: () => applyDoorStatusPlan({ doorId: door.doorId }),
        verify: () => applyVerifyPlan({ doorId: door.doorId }),
      },
      errorMessage,
    );
    setPlanResults((previous) => [
      ...previous.filter((result) => !keys.includes(result.key)),
      ...results,
    ]);
    return results.every((result) => result.ok);
  };

  const saveAction = useAsyncAction(
    async () => {
      const keys = await updateDoor({
        doorId: door.doorId,
        ...(statusChanged ? {
          hikDoorStatusPlan: useTemplate ? statusPlan : normalizeDoorStatusPlan(statusPlan),
          hikDoorStatusTemplateId: useTemplate ? (templateId as Id<"accessScheduleTemplates">) : null,
        } : {}),
        ...(verifyChanged ? { hikVerifyPlan: normalizeVerifyPlan(verifyPlan) } : {}),
        ...(holidayChanged ? { hikDoorHolidayPlan: holiday } : {}),
      });
      setSaved(true);
      if (!(await sendPlans(keys))) return;
      notify.success("Kapı planları kaydedildi ve cihaza uygulandı");
      onSuccess();
      onOpenChange(false);
    },
    { error: "Kapı kaydedilemedi" },
  );

  const retryAction = useAsyncAction(
    async () => {
      const failed = planResults
        .filter((result) => !result.ok)
        .map((result) => result.key);
      if (failed.length === 0) return;
      if (await sendPlans(failed))
        notify.success("Zaman planları cihaza uygulandı");
    },
    { error: "Planlar gönderilemedi" },
  );
  const isSubmitting = saveAction.pending || retryAction.pending;

  const initialVerify = door.hikVerifyPlan ?? DEFAULT_VERIFY_PLAN;
  const guard = useUnsavedChangesGuard(
    open &&
      !saved &&
      (useTemplate !== !!door.hikDoorStatusTemplateId ||
        templateId !== (door.hikDoorStatusTemplateId ?? "") ||
        JSON.stringify(holiday) !==
          JSON.stringify(
            door.hikDoorHolidayPlan ?? {
              enabled: false,
              year: new Date().getFullYear(),
              mode: "remainClosed",
            },
          ) ||
        JSON.stringify(statusPlan) !==
          JSON.stringify(door.hikDoorStatusPlan ?? DEFAULT_STATUS_PLAN) ||
        JSON.stringify(verifyPlan) !== JSON.stringify(initialVerify)),
  );
  const close = () => {
    if (!isSubmitting) guard.requestClose(() => onOpenChange(false));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saved || isSubmitting) return;
    const errors: Record<string, string> = {};
    {
      try {
        if (statusChanged && !useTemplate) normalizeDoorStatusPlan(statusPlan);
      } catch (error: unknown) {
        errors["status-plan"] = errorMessage(error);
      }
      try {
        if (verifyChanged) normalizeVerifyPlan(verifyPlan);
      } catch (error: unknown) {
        errors["verify-plan"] = errorMessage(error);
      }
      if (useTemplate && !templateId)
        errors["status-plan"] = "Zaman şablonu seçin";
      if (useTemplate && statusPlan.mode === "normal")
        errors["status-plan"] =
          "Şablon için sürekli açık veya sürekli kilitli seçin";
      if (holiday.enabled && (statusChanged || holidayChanged) && !holidayRanges?.length)
        errors["holiday-plan"] = holidayRanges === undefined ? "Tatil tarihleri yükleniyor" : "Seçilen yılda uygulanacak tatil yok";
      if (holiday.enabled && door.holidaySupported === false)
        errors["holiday-plan"] = "Bu cihaz tatil planını desteklemiyor";
    }

    setTimeErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }
    await saveAction.run();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kapı Planları</DialogTitle>
            <DialogDescription>
              {door.doorName} · {door.deviceName} kapısının zaman planlarını
              düzenleyin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} aria-busy={isSubmitting} noValidate>
            {Object.keys(timeErrors).length > 0 && (
              <div role="alert" className="mb-4 text-sm text-destructive">
                <p className="font-medium">
                  Kaydedilemedi. Alanları kontrol edin.
                </p>
                <ul className="list-disc pl-4">
                  {Object.entries(timeErrors).map(([key, message]) => (
                    <li key={key}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
            <fieldset disabled={isSubmitting || saved}>
              <div className="grid gap-4 py-4">
                <DoorStatusPlanSection
                  statusPlan={statusPlan}
                  setStatusPlan={setStatusPlan}
                  isSubmitting={isSubmitting}
                  saved={saved}
                >
                  <div
                    id="status-plan"
                    tabIndex={-1}
                    role="group"
                    aria-label="Kapı durum planı aralıkları"
                    aria-invalid={!!timeErrors["status-plan"]}
                    aria-describedby={
                      timeErrors["status-plan"]
                        ? "status-plan-error"
                        : undefined
                    }
                  >
                    <label className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        checked={useTemplate}
                        onChange={(event) => {
                          setUseTemplate(event.target.checked);
                          if (
                            event.target.checked &&
                            statusPlan.mode === "normal"
                          )
                            setStatusPlan((p) => ({
                              ...p,
                              mode: "remainClosed",
                            }));
                        }}
                      />{" "}
                      Zaman şablonu kullan
                    </label>
                    {useTemplate ? (
                      <div className="space-y-3">
                        <TemplatePicker
                          value={templateId}
                          currentTemplateId={
                            door.hikDoorStatusTemplateId ?? undefined
                          }
                          onChange={setTemplateId}
                          onEdit={(navigate) =>
                            guard.requestClose(() => {
                              onOpenChange(false);
                              navigate();
                            })
                          }
                        />
                        <label className="block">
                          Kapı modu
                          <select
                            aria-label="Şablon kapı modu"
                            className="h-10 w-full border rounded bg-background"
                            value={statusPlan.mode}
                            onChange={(event) => {
                              const mode = event.target.value;
                              if (
                                mode === "remainOpen" ||
                                mode === "remainClosed"
                              )
                                setStatusPlan((p) => ({ ...p, mode }));
                            }}
                          >
                            <option value="remainOpen">Sürekli açık</option>
                            <option value="remainClosed">
                              Sürekli kilitli
                            </option>
                          </select>
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Şablon değişiklikleri otomatik gönderilmez.
                          Güncellemek için yeniden kaydedip gönderin.
                        </p>
                      </div>
                    ) : (
                      <DoorStatusPlanEditor
                        value={statusPlan}
                        onChange={setStatusPlan}
                      />
                    )}
                    {timeErrors["status-plan"] && (
                      <p
                        id="status-plan-error"
                        className="mt-2 text-xs text-destructive"
                      >
                        {timeErrors["status-plan"]}
                      </p>
                    )}
                  </div>
                </DoorStatusPlanSection>

                <fieldset
                  id="holiday-plan"
                  className="rounded-md border p-3 space-y-3"
                >
                  <legend>Tatil planı</legend>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={holiday.enabled}
                      disabled={
                        door.holidaySupported === false && !holiday.enabled
                      }
                      onChange={(event) =>
                        setHoliday((p) => ({
                          ...p,
                          enabled: event.target.checked,
                        }))
                      }
                    />{" "}
                    Proje ve Türkiye geneli tatillerini uygula
                  </label>
                  {door.holidaySupported === false && (
                    <p role="alert">Bu cihaz tatil planını desteklemiyor</p>
                  )}
                  {door.holidaySupported === null && (
                    <p className="text-xs">
                      Cihaz desteği gönderimden önce denetlenir.
                    </p>
                  )}
                  {holiday.enabled && holidayRanges?.length === 0 && <p role="alert">Seçilen yılda uygulanacak tatil yok</p>}
                  {holiday.enabled && (
                    <>
                      <label className="block">
                        Yıl{" "}
                        <input
                          aria-label="Tatil yılı"
                          className="w-24 rounded border bg-background p-2"
                          type="number"
                          min={2000}
                          max={2100}
                          value={holiday.year}
                          onChange={(event) =>
                            setHoliday((p) => ({
                              ...p,
                              year: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="block">
                        Tatil kapı modu{" "}
                        <select
                          aria-label="Tatil kapı modu"
                          className="h-10 rounded border bg-background"
                          value={holiday.mode}
                          onChange={(event) => {
                            const mode = event.target.value;
                            if (
                              mode === "normal" ||
                              mode === "remainOpen" ||
                              mode === "remainClosed"
                            )
                              setHoliday((p) => ({ ...p, mode }));
                          }}
                        >
                          <option value="remainClosed">Sürekli kilitli</option>
                          <option value="remainOpen">Sürekli açık</option>
                          <option value="normal">Normal</option>
                        </select>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Seçilen yılın tatil tarihleri tam gün uygulanır (yarım
                        gün kayıtları dahil). Tatil değişikliklerinde yeniden
                        gönderin.
                      </p>
                    </>
                  )}
                </fieldset>
                <DoorVerifyPlanSection
                  verifyPlan={verifyPlan}
                  setVerifyPlan={setVerifyPlan}
                  isSubmitting={isSubmitting}
                  saved={saved}
                  timeErrors={timeErrors}
                />
              </div>
            </fieldset>
            {saved && (
              <DoorSaveResults
                planResults={planResults}
                isSubmitting={isSubmitting}
              />
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
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void retryAction.run()}
                  >
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
