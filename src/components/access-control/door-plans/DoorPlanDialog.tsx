import { DoorPlanImpactSummary } from "./DoorPlanImpactSummary";
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
import { useNavigate } from "react-router-dom";
import { PDKS_SETTINGS_PATH } from "@/components/pdks/settings/route";
import { formatTrDate } from "@/lib/date";
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
import { NativeSelect } from "@/components/ui/native-select";
import { errorMessage, notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import {
  applySelectedDoorPlans,
  allDoorPlansApplied,
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

/** YYYY-MM-DD takvim günü; tarayıcı saat diliminden bağımsız gün.ay.yıl metni. */
const formatHolidayDate = (date: string) => formatTrDate(new Date(`${date}T12:00:00Z`));

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
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [persistedSendResolved, setPersistedSendResolved] = useState(false);
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
  const statusEdited = JSON.stringify(statusPlan) !== JSON.stringify(door.hikDoorStatusPlan ?? DEFAULT_STATUS_PLAN) ||
    useTemplate !== !!door.hikDoorStatusTemplateId || templateId !== (door.hikDoorStatusTemplateId ?? "");
  const statusChanged = statusEdited || (useTemplate && door.templateChanged);
  const verifyChanged = JSON.stringify(verifyPlan) !== JSON.stringify(door.hikVerifyPlan ?? DEFAULT_VERIFY_PLAN);
  const holidayChanged = JSON.stringify(holiday) !== JSON.stringify(door.hikDoorHolidayPlan ?? {
    enabled: false, year: new Date().getFullYear(), mode: "remainClosed",
  });
  // Kullanıcının formda yaptığı düzenleme (şablonun dışarıda değişmesi sayılmaz).
  const formDirty = statusEdited || verifyChanged || holidayChanged;

  const updateDoor = useMutation(api.doors.updatePlans);
  const applyDoorStatusPlan = useAction(
    api.actions.hikGatewayDevice.applyDoorStatusPlan,
  );
  const applyVerifyPlan = useAction(
    api.actions.hikGatewayDevice.applyVerifyPlan,
  );

  const persistedKeys: PlanKey[] = [];
  // Kaydedilmiş devre dışı planlar da cihazdaki eski planı kaldırmak için gönderilir.
  if (door.hikDoorStatusPlan || door.hikDoorHolidayPlan?.enabled) persistedKeys.push("status");
  if (door.hikVerifyPlan) persistedKeys.push("verify");
  // Gönderilecek kayıtlı plan yoksa eski hata/bekleyen bayrağı için yapılacak bir şey yok.
  const persistedSendPending = !persistedSendResolved && persistedKeys.length > 0 &&
    !!(door.plansPending || door.hikPlanApplyError);
  const failedResults = planResults.filter((result) => !result.ok);
  const failedKeys = failedResults.map((result) => result.key);
  const pendingKeys = persistedSendPending ? persistedKeys : [];
  const retryKeys = [...new Set([...failedKeys, ...pendingKeys])];
  const statusMessage = failedKeys.length > 0 ? "Cihaza gönderilemedi"
    : door.hikPlanApplyError ? `Son gönderim başarısız: ${door.hikPlanApplyError}` : "Kaydedildi ama cihaza gönderilmedi";

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
    return allDoorPlansApplied(results);
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
      const keysToSend = [...new Set([...keys, ...pendingKeys])];
      if (keysToSend.length === 0) {
        notify.info("Değişiklik yok; cihaza bir şey gönderilmedi.");
        return;
      }
      setSaved(keys.length > 0);
      setPersistedSendResolved(true);
      if (!(await sendPlans(keysToSend))) return;
      notify.success(keys.length > 0 ? "Kapı planları kaydedildi ve cihaza uygulandı" : "Zaman planları cihaza uygulandı");
      onSuccess();
      onOpenChange(false);
    },
    { error: "Kapı kaydedilemedi" },
  );

  const retryAction = useAsyncAction(
    async () => {
      if (retryKeys.length === 0) return;
      setPersistedSendResolved(true);
      if (await sendPlans(retryKeys)) {
        notify.success("Zaman planları cihaza uygulandı");
        // Üst bileşenin onSuccess çağrısı da formu kapatabildiği için düzenleme varken çağırma.
        if (saved || !formDirty) {
          onSuccess();
          onOpenChange(false);
        }
      }
    },
    { error: "Planlar gönderilemedi" },
  );
  const isSubmitting = saveAction.pending || retryAction.pending;

  const guard = useUnsavedChangesGuard(open && !saved && formDirty);
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
              {door.doorName} · {door.deviceName} kapısının zaman planlarını düzenleyin. Kaydettiğinizde plan hemen cihaza gönderilir.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} aria-busy={isSubmitting} noValidate>
            {retryKeys.length > 0 && (
              <div role="status" className="mb-4 space-y-2 text-sm">
                <p>{statusMessage}</p>
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => void retryAction.run()}>
                  {isSubmitting ? "Gönderiliyor…" : "Cihaza tekrar gönder"}
                </Button>
              </div>
            )}
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
                          <NativeSelect
                            aria-label="Şablon kapı modu"
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
                          </NativeSelect>
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
                        invalid={!!timeErrors["status-plan"]}
                        aria-describedby={
                          timeErrors["status-plan"]
                            ? "status-plan-error"
                            : undefined
                        }
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
                  {holiday.enabled && holidayRanges?.length === 0 && (
                    <div className="space-y-2">
                      <p role="alert">Seçilen yılda uygulanacak tatil yok</p>
                      <Button type="button" variant="outline" onClick={() => guard.requestClose(() => {
                        onOpenChange(false);
                        navigate(PDKS_SETTINGS_PATH);
                      })}>Tatil takvimini aç</Button>
                    </div>
                  )}
                  {holiday.enabled && holidayRanges && holidayRanges.length > 0 && (
                    <div className="text-sm" aria-label="Uygulanacak tatil tarihleri">
                      <p className="font-medium">Uygulanacak tatil tarihleri</p>
                      <ul>
                        {holidayRanges.slice(0, 10).map((range) => (
                          <li key={range.beginDate}>{formatHolidayDate(range.beginDate)}–{formatHolidayDate(range.endDate)} · tam gün</li>
                        ))}
                      </ul>
                      {holidayRanges.length > 10 && <p>ve {holidayRanges.length - 10} tarih daha</p>}
                    </div>
                  )}
                  {holiday.enabled && (
                    <>
                      <label className="block">
                        Yıl{" "}
                        <Input
                          aria-label="Tatil yılı"
                          className="w-24"
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
                        <NativeSelect
                          aria-label="Tatil kapı modu"
                          className="w-auto"
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
                        </NativeSelect>
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
            {planResults.length > 0 && (
              <DoorSaveResults
                saved={saved}
                planResults={planResults}
                isSubmitting={isSubmitting}
              />
            )}
            {!saved && (statusChanged || verifyChanged || holidayChanged) && (
              <DoorPlanImpactSummary
                doorName={door.doorName}
                statusPlan={statusChanged ? statusPlan : undefined}
                template={useTemplate}
                verifyPlan={verifyChanged ? verifyPlan : undefined}
                holiday={holidayChanged ? holiday : undefined}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>
                {saved ? "Kapat" : "İptal"}
              </Button>
              {!saved && (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Gönderiliyor…" : "Kaydet ve cihaza gönder"}
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
