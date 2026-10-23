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
import { Button } from "@/components/ui/button";
import { TemplatePicker } from "../unified/templates/TemplatePicker";
import type { DoorPlanTarget } from "./DoorPlanDialog";
import { normalizeVerifyPlan } from "../../../../convex/lib/doorStatusPlan";
import { applyBulkPlans, bulkFailed, type BulkResult } from "./bulk";
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
  const [templateId, setTemplateId] = useState("");
  const [sourceType, setSourceType] = useState("door");
  const [mode, setMode] = useState<"remainOpen" | "remainClosed">(
    "remainClosed",
  );
  const [results, setResults] = useState<BulkResult[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.doors.updatePlans);
  const status = useAction(api.actions.hikGatewayDevice.applyDoorStatusPlan);
  const verify = useAction(api.actions.hikGatewayDevice.applyVerifyPlan);
  const source = targets.find((door) => door.doorId === sourceId);
  const sourceHoliday = sourceType === "door" ? source?.hikDoorHolidayPlan : null;
  const holidayRanges = useQuery(api.doors.listPlanHolidays, sourceHoliday?.enabled
    ? { projectId: source?.projectId, year: sourceHoliday.year } : "skip");
  const holidayBlocked = !!sourceHoliday?.enabled && !holidayRanges?.length;
  const run = async (retry = false) => {
    if (pending || holidayBlocked) return;
    if (
      (sourceType === "door" && !source) ||
      (sourceType === "template" && !templateId)
    ) {
      setError("Kaynak seçin");
      return;
    }
    setPending(true);
    setError("");
    try {
      const next = await applyBulkPlans(
        selectedIds,
        (doorId) => {
          const target = targets.find(door => door.doorId === doorId);
          const copyVerify = source?.hikVerifyPlan && JSON.stringify(normalizeVerifyPlan(source.hikVerifyPlan)) !==
            JSON.stringify(target?.hikVerifyPlan ? normalizeVerifyPlan(target.hikVerifyPlan) : null);
          return save(
            sourceType === "template"
              ? {
                  doorId,
                  hikDoorStatusTemplateId:
                    templateId as Id<"accessScheduleTemplates">,
                  hikDoorStatusPlan: {
                    enabled: true,
                    beginTime: "08:00",
                    endTime: "18:00",
                    mode,
                  },
                }
              : {
                  doorId,
                  ...(source?.hikDoorStatusPlan ? {
                    hikDoorStatusTemplateId: source.hikDoorStatusTemplateId ?? null,
                    hikDoorStatusPlan: source.hikDoorStatusPlan,
                  } : {}),
                  ...(copyVerify && source?.hikVerifyPlan ? { hikVerifyPlan: source.hikVerifyPlan } : {}),
                  ...(source?.hikDoorHolidayPlan ? { hikDoorHolidayPlan: source.hikDoorHolidayPlan } : {}),
                },
          );
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Planı kopyala</DialogTitle>
          <DialogDescription>
            {selectedIds.length} kapıya kaydedip cihaza gönderin. Sürekli açık
            modu kapıyı açık bırakır.
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={pending || results.length > 0}
          className="space-y-3"
        >
          <label className="block">
            Kaynak türü{" "}
            <select
              aria-label="Kaynak türü"
              className="w-full border bg-background rounded p-2"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              <option value="door">Kapının tüm planları</option>
              <option value="template">Zaman şablonu (durum planı)</option>
            </select>
          </label>
          {sourceType === "door" ? (
            <label className="block">
              Kaynak kapı{" "}
              <select
                aria-label="Kaynak kapı"
                className="w-full border bg-background rounded p-2"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
              >
                {targets.map((door) => (
                  <option key={door.doorId} value={door.doorId}>
                    {door.doorName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <TemplatePicker value={templateId} onChange={setTemplateId} />
              <label className="block">
                Kapı modu{" "}
                <select
                  aria-label="Kopyalanacak kapı modu"
                  value={mode}
                  onChange={(event) => {
                    const v = event.target.value;
                    if (v === "remainOpen" || v === "remainClosed") setMode(v);
                  }}
                >
                  <option value="remainClosed">Sürekli kilitli</option>
                  <option value="remainOpen">Sürekli açık</option>
                </select>
              </label>
            </>
          )}
        </fieldset>
        {holidayBlocked && <p role="alert">{holidayRanges === undefined ? "Tatil tarihleri yükleniyor" : "Seçilen yılda uygulanacak tatil yok"}</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {results.length > 0 && (
          <ul aria-label="Kapı başına gönderim sonuçları" className="space-y-2">
            {results.map((row) => (
              <li key={row.doorId}>
                <strong>
                  {targets.find((door) => door.doorId === row.doorId)?.doorName}
                </strong>
                :{" "}
                {bulkFailed(row)
                  ? `Hata: ${
                      row.error ??
                      row.plans
                        .filter((plan) => !plan.ok)
                        .map((plan) => plan.error)
                        .join("; ")
                    }`
                  : "Başarılı"}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Kapat
          </Button>
          {!results.length ? (
            <Button
              disabled={pending || holidayBlocked || selectedIds.length > 50}
              onClick={() => void run()}
            >
              {pending ? "Gönderiliyor…" : "Kaydet ve gönder"}
            </Button>
          ) : (
            results.some(bulkFailed) && (
              <Button disabled={pending} onClick={() => void run(true)}>
                {pending ? "Gönderiliyor…" : "Hatalıları tekrar gönder"}
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
