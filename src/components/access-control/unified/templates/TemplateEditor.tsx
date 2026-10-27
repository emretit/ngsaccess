import { addInterval, removeInterval, saveDecision } from "./model";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import { useId, useState } from "react";
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
  timeFieldError,
  overnightDescription,
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
  const editorId = useId();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
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
          className="min-h-11"
          onClick={() => onChange(emptyWeek())}
        >
          Tümünü temizle
        </Button>
      </div>
      {WEEKDAYS.map((day, i) => (
        <fieldset key={day} className="border rounded p-3 space-y-2 min-w-0">
          <legend className="px-1 text-sm font-medium">{DAY_NAMES[i]}</legend>
          {week[day].map((r, n) => {
            const rowId = `${editorId}-${day}-${n}`;
            const overnight = overnightDescription(day, r);
            const errors = (["start", "end"] as const).map((field) => ({
              field,
              message: timeFieldError(r, field),
            }));
            return (
              <div key={n} className="space-y-2">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[6rem_6rem_auto] sm:justify-start gap-2 items-start">
                  {errors.map(({ field, message }) => (
                    <div key={field} className="min-w-0 space-y-1">
                      <Label htmlFor={`${rowId}-${field}`}>
                        {field === "start" ? "Başlangıç" : "Bitiş"}
                      </Label>
                      <Input
                        id={`${rowId}-${field}`}
                        aria-label={`${DAY_NAMES[i]} ${n + 1}. ${field === "start" ? "başlangıç" : "bitiş"}`}
                        className="w-full min-w-0 min-h-11"
                        aria-invalid={!!message}
                        aria-describedby={
                          message
                            ? `${rowId}-${field}-error`
                            : `${rowId}-${field}-hint`
                        }
                        placeholder="22:00"
                        list={
                          field === "end" ? `${editorId}-end-times` : undefined
                        }
                        value={r[field]}
                        onChange={(e) =>
                          onChange({
                            ...week,
                            [day]: week[day].map((v, index) =>
                              index === n
                                ? { ...v, [field]: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                      <p
                        id={`${rowId}-${field}-hint`}
                        className="text-xs text-muted-foreground"
                      >
                        {field === "start"
                          ? "Örnek: 22:00"
                          : "Örnek: 22:00 · En fazla 24:00"}
                      </p>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 mt-6"
                    aria-label={`${DAY_NAMES[i]} ${n + 1}. aralığı sil`}
                    onClick={() => onChange(removeInterval(week, day, n))}
                  >
                    Sil
                  </Button>
                </div>
                {errors
                  .filter(({ message }) => message)
                  .map(({ field, message }) => (
                    <p
                      key={field}
                      id={`${rowId}-${field}-error`}
                      role="alert"
                      className="text-sm text-danger"
                    >
                      {DAY_NAMES[i]} {n + 1}. aralık: {message}
                    </p>
                  ))}
                {overnight && (
                  <p className="text-sm" role="status">
                    {DAY_NAMES[i]} {n + 1}. aralık: {overnight}
                  </p>
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={week[day].length >= 8}
            onClick={() => onChange(addInterval(week, day))}
          >
            {DAY_NAMES[i]} aralık ekle
          </Button>
        </fieldset>
      ))}
      <datalist id={`${editorId}-end-times`}>
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
  const weekChanged =
    JSON.stringify(check.week) !==
    JSON.stringify(
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
                className="min-h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="template-description">Açıklama</Label>
              <Input
                id="template-description"
                className="min-h-11"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <WeekEditor week={week} onChange={setWeek} />
          </fieldset>
          <section className="space-y-1" aria-label="Cihaz uyumluluğu">
            <h3 className="font-medium">Cihaz uyumluluğu</h3>
            <p>
              Hikvision: günde en fazla 8 aralık — bu şablonda en çok{" "}
              {check.hik} {check.hik <= 8 ? "✓" : "✗"}
            </p>
            <p>
              IDE: en fazla 8 izin kaydı — bu şablon {check.ide} kullanıyor{" "}
              {check.ide <= 8 ? "✓" : "✗"}
            </p>
            {(check.hik > 8 || check.ide > 8) && (
              <p className="text-danger">
                Aralıkları birleştirin ya da azaltın.
              </p>
            )}
          </section>
          {check.error && (
            <p role="alert" className="text-danger">
              {check.error}
            </p>
          )}
          {check.week && (
            <>
              <h3 className="font-medium">Haftalık geçiş saatleri</h3>
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
              className="min-h-11"
              disabled={pending || !name.trim() || !!check.error || !check.week}
              onClick={() => void save()}
            >
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          )}

          <Button
            className="min-h-11"
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
          <p className="text-danger">IDE cihazında 16 izin sınırı aşılıyor</p>
          <ul className="text-xs break-all">
            {impact.ideOverLimit.map((v) => (
              <li key={`${v.employeeId}/${v.deviceId}`}>
                {v.employeeName?.trim() || v.employeeId} —{" "}
                {v.deviceName?.trim() || v.deviceId} (toplam {v.total}/16)
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          variant="outline"
          disabled={pending}
          onClick={onBack}
        >
          Geri dön
        </Button>
        <Button
          className="min-h-11"
          disabled={pending || impact.ideOverLimit.length > 0}
          onClick={onConfirm}
        >
          Onayla ve kaydet
        </Button>
      </div>
    </div>
  );
}
