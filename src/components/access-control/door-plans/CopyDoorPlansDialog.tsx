import { useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import type { DoorPlanTarget } from "./DoorPlanDialog";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import {
  applyBulkPlans,
  bulkFailed,
  bulkResultLabel,
  MAX_BULK_DOORS,
  type BulkResult,
  copyPlanFields,
  COPY_PLAN_LABELS,
  type CopyPlanType,
} from "./bulk";
const modeLabels: Record<string, string> = {
  remainOpen: "Sürekli açık",
  remainClosed: "Sürekli kilitli",
  normal: "Normal geçiş",
  card: "Kart",
  face: "Yüz",
  fp: "Parmak izi",
  cardOrFace: "Kart veya yüz",
  cardAndPw: "Kart ve şifre",
  cardAndFace: "Kart ve yüz",
  faceAndCard: "Kart ve yüz",
};
function sourceSummary(
  source: DoorPlanTarget | undefined,
  type: CopyPlanType,
): string {
  if (type === "holiday") {
    const plan = source?.hikDoorHolidayPlan;
    if (!plan) return "Kaynakta yok";
    return `${plan.year} · ${plan.enabled ? modeLabels[plan.mode] : "Plan etkin değil"}`;
  }
  const plan =
    type === "status" ? source?.hikDoorStatusPlan : source?.hikVerifyPlan;
  if (!plan) return "Kaynakta yok";
  if (!plan.enabled) return "Plan etkin değil";
  if (plan.weekly)
    return `Haftalık · ${plan.weekly.filter((day) => day.segments.length).length} gün · ${plan.weekly.reduce((count, day) => count + day.segments.length, 0)} aralık`;
  const mode = "verifyMode" in plan ? plan.verifyMode : plan.mode;
  return `${plan.beginTime.slice(0, 5)}–${plan.endTime.slice(0, 5)} · ${modeLabels[mode] ?? mode}`;
}

export function CopyDoorPlansDialog({
  targets,
  selectedIds,
  onClose,
}: {
  targets: DoorPlanTarget[];
  selectedIds: Id<"doors">[];
  onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState<string>(targets[0]?.doorId ?? "");
  const [planTypes, setPlanTypes] = useState<CopyPlanType[]>([
    "status",
    "verify",
    "holiday",
  ]);
  const [selectionChanged, setSelectionChanged] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.doors.updatePlans);
  const status = useAction(api.actions.hikGatewayDevice.applyDoorStatusPlan);
  const verify = useAction(api.actions.hikGatewayDevice.applyVerifyPlan);
  const source = targets.find((door) => door.doorId === sourceId);
  const guard = useUnsavedChangesGuard(!results.length && selectionChanged);
  const destinationIds = [...new Set(selectedIds)].filter(
    (id) => targets.some((door) => door.doorId === id) && id !== sourceId,
  );
  const destinations = destinationIds
    .map((id) => targets.find((door) => door.doorId === id))
    .filter((door): door is DoorPlanTarget => !!door);
  const availableTypes = planTypes.filter((type) =>
    type === "status"
      ? !!source?.hikDoorStatusPlan
      : type === "verify"
        ? !!source?.hikVerifyPlan
        : !!source?.hikDoorHolidayPlan,
  );
  const sourceHoliday = planTypes.includes("holiday")
    ? source?.hikDoorHolidayPlan
    : null;
  const holidayRanges = useQuery(
    api.doors.listPlanHolidays,
    sourceHoliday?.enabled
      ? { projectId: source?.projectId, year: sourceHoliday.year }
      : "skip",
  );
  const holidayBlocked = !!sourceHoliday?.enabled && !holidayRanges?.length;
  const run = async (retry = false) => {
    if (
      pending ||
      holidayBlocked ||
      !destinationIds.length ||
      !availableTypes.length
    )
      return;
    if (!source) {
      setError("Kaynak seçin");
      return;
    }
    setPending(true);
    setError("");
    try {
      const next = await applyBulkPlans(
        destinationIds,
        (doorId) => {
          const target = targets.find((door) => door.doorId === doorId);
          return save({
            doorId,
            ...copyPlanFields(source, target, planTypes),
          });
        },
        {
          status: (doorId) => status({ doorId }),
          verify: (doorId) => verify({ doorId }),
        },
        retry ? results : [],
      );
      setResults(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planlar kopyalanamadı");
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !pending) guard.requestClose(onClose);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planı kopyala</DialogTitle>
            <DialogDescription>
              Seçilen planları kaydedip cihaza gönderin. Sürekli açık modu
              kapıyı açık bırakır.
            </DialogDescription>
          </DialogHeader>
          <fieldset
            disabled={pending || results.length > 0}
            className="space-y-3"
          >
            <label className="block">
              Kaynak kapı{" "}
              <NativeSelect
                aria-label="Kaynak kapı"
                className="w-full min-h-11"
                value={sourceId}
                onChange={(event) => {
                  setSourceId(event.target.value);
                  setSelectionChanged(true);
                }}
              >
                {targets.map((door) => (
                  <option key={door.doorId} value={door.doorId}>
                    {door.doorName} · {door.deviceName}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <div aria-label="Kopyalanacak plan türleri">
              {(Object.keys(COPY_PLAN_LABELS) as CopyPlanType[]).map((type) => (
                <label key={type} className="flex items-center gap-2 min-h-11">
                  <input
                    type="checkbox"
                    checked={planTypes.includes(type)}
                    onChange={(event) => {
                      setPlanTypes((previous) =>
                        event.target.checked
                          ? [...previous, type]
                          : previous.filter((item) => item !== type),
                      );
                      setSelectionChanged(true);
                    }}
                  />
                  {COPY_PLAN_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <section
            aria-label="Kopyalama önizlemesi"
            className="space-y-2 text-sm break-words min-w-0"
          >
            <ul>
              {planTypes.map((type) => (
                <li key={type}>
                  {COPY_PLAN_LABELS[type]}: {sourceSummary(source, type)}
                </li>
              ))}
            </ul>
            <p>
              Kaynakta olmayan veya seçilmeyen plan türleri hedefte korunur.
            </p>
            <details>
              <summary className="min-h-11 cursor-pointer py-3">
                {destinations.length} hedef kapı — listeyi aç
              </summary>
              <ul aria-label="Hedef kapılar">
                {destinations.map((door) => (
                  <li key={door.doorId}>
                    {door.doorName} · {door.deviceName}
                  </li>
                ))}
              </ul>
            </details>
            {!destinations.length && (
              <p>Kaynak dışında en az bir hedef kapı seçin.</p>
            )}
            {!availableTypes.length && (
              <p>Kaynakta bulunan en az bir plan türünü seçin.</p>
            )}
          </section>
          {holidayBlocked && (
            <p role="alert">
              {holidayRanges === undefined
                ? "Tatil tarihleri yükleniyor"
                : "Seçilen yılda uygulanacak tatil yok"}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {results.length > 0 && (
            <section
              aria-label="Kapı başına gönderim sonuçları"
              className="space-y-2 text-sm"
            >
              <p role="status">
                {results.length} kapı ·{" "}
                {
                  results.filter((row) => bulkResultLabel(row) === "Gönderildi")
                    .length
                }{" "}
                gönderildi ·{" "}
                {
                  results.filter((row) => !bulkFailed(row) && !row.plans.length)
                    .length
                }{" "}
                değişiklik yok · {results.filter(bulkFailed).length}{" "}
                gönderilemedi
              </p>
              <ul>
                {results.filter(bulkFailed).map((row) => (
                  <li key={row.doorId}>
                    <strong>
                      {
                        targets.find((door) => door.doorId === row.doorId)
                          ?.doorName
                      }
                    </strong>
                    : Gönderilemedi
                    <p>
                      {row.error ??
                        row.plans
                          .filter((plan) => !plan.ok)
                          .map((plan) => plan.error)
                          .join("; ")}
                    </p>
                  </li>
                ))}
              </ul>
              {results.some((row) => !bulkFailed(row)) && (
                <details>
                  <summary className="min-h-11 cursor-pointer py-3">
                    Diğer sonuçları göster
                  </summary>
                  <ul>
                    {results
                      .filter((row) => !bulkFailed(row))
                      .map((row) => (
                        <li key={row.doorId}>
                          {
                            targets.find((door) => door.doorId === row.doorId)
                              ?.doorName
                          }
                          : {bulkResultLabel(row)}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </section>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              disabled={pending}
              className="min-h-11"
              onClick={() => guard.requestClose(onClose)}
            >
              Kapat
            </Button>
            {!results.length ? (
              <Button
                className="min-h-11"
                disabled={
                  pending ||
                  holidayBlocked ||
                  !destinationIds.length ||
                  !availableTypes.length ||
                  destinationIds.length > MAX_BULK_DOORS
                }
                onClick={() => void run()}
              >
                {pending ? "Gönderiliyor…" : "Kaydet ve gönder"}
              </Button>
            ) : (
              results.some(bulkFailed) && (
                <Button
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => void run(true)}
                >
                  {pending ? "Gönderiliyor…" : "Hatalıları tekrar gönder"}
                </Button>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}
