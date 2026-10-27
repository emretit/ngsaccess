import { addInterval, removeInterval, saveDecision } from "./model";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeekPreview } from "./WeekPreview";
import {
  DAY_NAMES,
  WEEKDAYS,
  emptyWeek,
  inspectSchedule,
  invalidTimeField,
  type WeekSchedule,
} from "./schedule";
export type Template = FunctionReturnType<
  typeof api.accessScheduleTemplates.list
>[number];
export function WeekEditor({
  week,
  onChange,
}: {
  week: WeekSchedule;
  onChange: (week: WeekSchedule) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...week,
              ...Object.fromEntries(
                WEEKDAYS.slice(1, 5).map((d) => [
                  d,
                  week.Monday.map((r) => ({ ...r })),
                ]),
              ),
            })
          }
        >
          Pazartesi'yi hafta içine kopyala
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange(emptyWeek())}
        >
          Tümünü temizle
        </Button>
      </div>
      {WEEKDAYS.map((day, i) => (
        <fieldset key={day} className="border rounded p-3 space-y-2 min-w-0">
          <legend className="px-1 text-sm font-medium">{DAY_NAMES[i]}</legend>
          {week[day].map((r, n) => (
            <div key={n} className="flex flex-wrap gap-2 items-center">
              {(["start", "end"] as const).map((field) => (
                <Input
                  key={field}
                  aria-label={`${DAY_NAMES[i]} ${n + 1}. ${field === "start" ? "başlangıç" : "bitiş"}`}
                  className="w-24 min-w-0"
                  aria-invalid={invalidTimeField(r, field)}
                  placeholder="HH:MM"
                  list={field === "end" ? "schedule-end-times" : undefined}
                  value={r[field]}
                  onChange={(e) =>
                    onChange({
                      ...week,
                      [day]: week[day].map((v, index) =>
                        index === n ? { ...v, [field]: e.target.value } : v,
                      ),
                    })
                  }
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                aria-label={`${DAY_NAMES[i]} ${n + 1}. aralığı sil`}
                onClick={() => onChange(removeInterval(week, day, n))}
              >
                Sil
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={week[day].length >= 8}
            onClick={() => onChange(addInterval(week, day))}
          >
            {DAY_NAMES[i]} aralık ekle
          </Button>
        </fieldset>
      ))}
      <datalist id="schedule-end-times">
        <option value="24:00" />
      </datalist>
    </div>
  );
}
export function TemplateEditor({
  template,
  projectId,
  onClose,
}: {
  template: Template | null;
  projectId: Id<"projects">;
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [week, setWeek] = useState(template?.week ?? emptyWeek());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [impact, setImpact] = useState<FunctionReturnType<
    typeof api.accessScheduleTemplates.previewImpact
  > | null>(null);
  const dirty =
    name !== (template?.name ?? "") ||
    description !== (template?.description ?? "") ||
    JSON.stringify(week) !== JSON.stringify(template?.week ?? emptyWeek());
  const guard = useUnsavedChangesGuard(dirty);
  useProjectChangeGuard(dirty || pending, (proceed) => {
    if (!pending) guard.requestClose(proceed);
  });
  const client = useConvex();
  const create = useMutation(api.accessScheduleTemplates.create);
  const update = useMutation(api.accessScheduleTemplates.update);
  const check = inspectSchedule(week);
  const weekChanged = JSON.stringify(check.week) !== JSON.stringify(
    template ? inspectSchedule(template.week).week : emptyWeek(),
  );
  const save = async (confirmed = false) => {
    const decision = saveDecision({
      valid: !!check.week && !check.error,
      pending,
      name,
      ruleCount: template?.ruleCount ?? 0,
      confirmed,
      overLimit: impact?.ideOverLimit.length ?? 0,
    });
    if (decision === "disabled" || !check.week) return;
    setPending(true);
    setError("");
    try {
      if (template && decision === "preview") {
        setImpact(
          await client.query(api.accessScheduleTemplates.previewImpact, {
            templateId: template._id,
            week: check.week,
          }),
        );
        return;
      }
      if (impact?.ideOverLimit.length) return;
      if (template)
        await update({
          templateId: template._id,
          name,
          description,
          week: check.week,
        });
      else await create({ projectId, name, description, week: check.week });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Şablon kaydedilemedi");
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
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto min-w-0">
          <DialogHeader>
            <DialogTitle>
              {template ? "Şablonu düzenle" : "Yeni zaman şablonu"}
            </DialogTitle>
            <DialogDescription>
              Haftalık erişim aralıklarını Türkiye saatine göre belirleyin.
            </DialogDescription>
          </DialogHeader>
          <fieldset
            disabled={pending || !!impact}
            className="space-y-4 min-w-0"
          >
            <div>
              <Label htmlFor="template-name">Ad</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="template-description">Açıklama</Label>
              <Input
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <WeekEditor week={week} onChange={setWeek} />
          </fieldset>
          {check.overnight.map((v) => (
            <p key={v} className="text-sm" role="status">
              {v}
            </p>
          ))}
          <p role="status">
            Hik: gün başına en çok {check.hik} aralık{" "}
            {check.hik <= 8 ? "✓" : "✗"}(8) · IDE: {check.ide} izin kaydı{" "}
            {check.ide <= 8 ? "✓" : "✗"}(8)
          </p>
          {check.error && (
            <p role="alert" className="text-danger">
              {check.error}
            </p>
          )}
          {check.week && (
            <>
              <h3 className="font-medium">Birleştirilmiş önizleme</h3>
              <WeekPreview week={check.week} />
              {check.ide === 0 && (
                <p role="status">Bu şablon hiç erişim vermez</p>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-danger break-words">
              {error}
            </p>
          )}
          {impact ? (
            <ImpactConfirmation
              impact={impact}
              weekChanged={weekChanged}
              pending={pending}
              onBack={() => setImpact(null)}
              onConfirm={() => void save(true)}
            />
          ) : (
            <Button
              disabled={pending || !name.trim() || !!check.error || !check.week}
              onClick={() => void save()}
            >
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => guard.requestClose(onClose)}
          >
            Vazgeç
          </Button>
        </DialogContent>
      </Dialog>
      {guard.dialog}
    </>
  );
}

export function ImpactConfirmation({
  impact,
  weekChanged = true,
  pending,
  onBack,
  onConfirm,
}: {
  impact: FunctionReturnType<typeof api.accessScheduleTemplates.previewImpact>;
  weekChanged?: boolean;
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="space-y-3 border rounded p-3"
      role="alertdialog"
      aria-label="Şablon değişikliğini onayla"
    >
      <p>
        {weekChanged
          ? `${impact.ruleCount} kural ve ${impact.deviceCount} cihaz güncellenecek; cihaz gönderimi yaklaşık 20 saniye içinde başlar.`
          : "Geçiş saatleri değişmedi; cihaza gönderim gerekmiyor."}
      </p>
      {impact.ideOverLimit.length > 0 && (
        <>
          <p className="text-danger">IDE panelinde 16 izin sınırı aşılıyor</p>
          <ul className="text-xs break-all">
            {impact.ideOverLimit.map((v) => (
              <li key={`${v.employeeId}/${v.deviceId}`}>
                {v.employeeName?.trim() || v.employeeId} — {v.deviceName?.trim() || v.deviceId} (toplam {v.total}/16)
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={onBack}>
          Geri dön
        </Button>
        <Button
          disabled={pending || impact.ideOverLimit.length > 0}
          onClick={onConfirm}
        >
          Onayla ve kaydet
        </Button>
      </div>
    </div>
  );
}
