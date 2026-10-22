import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { errorMessage } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function tomorrowInTurkey(now = new Date()): string {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
const deviceId = z
  .string()
  .min(1)
  .transform((value) => value as Id<"devices">);
const doorId = z
  .string()
  .min(1)
  .transform((value) => value as Id<"doors">);
export const pdksRuleSchema = z
  .object({
    effectiveFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T12:00:00Z`);
        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          value >= tomorrowInTurkey()
        );
      }, "Geçerlilik tarihi en erken yarın olmalı."),
    punchMode: z.enum(["legacy", "requirements"]),
    requireCheckIn: z.boolean(),
    requireCheckOut: z.boolean(),
    missingRequiredPunch: z.enum(["review", "absent"]),
    noPunch: z.enum(["absent", "review"]),
    checkpointMode: z.enum(["all", "selected"]),
    targets: z
      .array(
        z.discriminatedUnion("targetType", [
          z.object({ targetType: z.literal("device"), deviceId }),
          z.object({ targetType: z.literal("door"), deviceId, doorId }),
        ]),
      )
      .max(500, "En fazla 500 nokta seçebilirsiniz."),
  })
  .refine(
    (value) => value.checkpointMode !== "selected" || value.targets.length > 0,
    {
      path: ["targets"],
      message: "En az bir kapı veya cihaz seçin.",
    },
  );
export type PdksRuleValues = z.infer<typeof pdksRuleSchema>;
export const recommendedPunchRules = {
  requireCheckIn: true,
  requireCheckOut: true,
  missingRequiredPunch: "review",
  noPunch: "absent",
} as const;
export function pdksPublishPayload(
  projectId: Id<"projects">,
  values: PdksRuleValues,
) {
  return {
    projectId,
    effectiveFrom: values.effectiveFrom,
    punchMode: values.punchMode,
    ...(values.punchMode === "requirements"
      ? {
          requireCheckIn: values.requireCheckIn,
          requireCheckOut: values.requireCheckOut,
          missingRequiredPunch: values.missingRequiredPunch,
          noPunch: values.noPunch,
        }
      : {}),
    checkpointMode: values.checkpointMode,
    ...(values.checkpointMode === "selected"
      ? { targets: values.targets }
      : {}),
  };
}
type Rule = NonNullable<
  FunctionReturnType<typeof api.pdksRules.getRules>["current"]
>;
type Targets = FunctionReturnType<typeof api.pdksRules.listCheckpointTargets>;
function Choice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function ruleSummary(rule: Rule | null, targets: Targets | undefined): string {
  if (!rule) return "Mevcut davranış · Tüm kapı ve cihazlar";
  const mode =
    rule.punchMode === "legacy"
      ? "Mevcut davranış"
      : `Giriş ${rule.requireCheckIn ? "zorunlu" : "isteğe bağlı"}, çıkış ${rule.requireCheckOut ? "zorunlu" : "isteğe bağlı"}; eksik zorunlu okutma: ${rule.missingRequiredPunch === "review" ? "İnceleme" : "Devamsız"}; hiç okutma yoksa: ${rule.noPunch === "review" ? "İnceleme" : "Devamsız"}`;
  const points =
    rule.checkpointMode === "all"
      ? "Tüm kapı ve cihazlar"
      : `${rule.targets.length} seçili nokta: ${rule.targets.map((target) => (target.targetType === "door" ? (targets?.doors.find((door) => door.doorId === target.doorId)?.name ?? "Kapı (artık listede yok)") : `${targets?.devices.find((device) => device.deviceId === target.deviceId)?.name ?? "Cihaz (artık listede yok)"} — tüm geçişler`)).join(", ")}`;
  return `${mode} · ${points}`;
}
export function PdksRulesSettings() {
  const { projectId, isAdmin } = useActiveProjectScope();
  const rules = useQuery(
    api.pdksRules.getRules,
    isAdmin && projectId ? { projectId } : "skip",
  );
  const targets = useQuery(
    api.pdksRules.listCheckpointTargets,
    isAdmin && projectId ? { projectId } : "skip",
  );
  if (!isAdmin || !projectId) return null;
  if (!rules || !targets)
    return (
      <section aria-label="PDKS devam kuralları" role="status">
        PDKS devam kuralları yükleniyor.
      </section>
    );
  return (
    <RulesEditor
      key={projectId}
      projectId={projectId}
      rules={rules}
      targets={targets}
    />
  );
}
function RulesEditor({
  projectId,
  rules,
  targets,
}: {
  projectId: Id<"projects">;
  rules: FunctionReturnType<typeof api.pdksRules.getRules>;
  targets: Targets;
}) {
  const publish = useMutation(api.pdksRules.publishRuleVersion);
  const remove = useMutation(api.pdksRules.deleteFutureRuleVersion);
  const [values, setValues] = useState<PdksRuleValues>(() => ({
    effectiveFrom: tomorrowInTurkey(),
    punchMode: "legacy",
    ...recommendedPunchRules,
    checkpointMode: "all",
    targets: [],
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmation, setConfirmation] = useState<
    | { kind: "publish"; values: PdksRuleValues }
    | { kind: "delete"; rule: Rule }
    | null
  >(null);
  const change = (patch: Partial<PdksRuleValues>) => {
    setValues((previous) => ({ ...previous, ...patch }));
    setError("");
    setSuccess("");
  };
  const save = async (parsed: PdksRuleValues) => {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await publish(pdksPublishPayload(projectId, parsed));
      setSuccess("Yeni PDKS kural sürümü yayınlandı.");
      setConfirmation(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };
  const toggleTarget = (
    target: PdksRuleValues["targets"][number],
    checked: boolean,
  ) => {
    const key = (item: PdksRuleValues["targets"][number]) =>
      item.targetType === "door"
        ? `door:${item.doorId}`
        : `device:${item.deviceId}`;
    change({
      targets: checked
        ? [...values.targets, target]
        : values.targets.filter((item) => key(item) !== key(target)),
    });
  };
  return (
    <section className="space-y-5" aria-labelledby="pdks-rules-heading">
      <div>
        <h2 id="pdks-rules-heading" className="text-lg font-semibold">
          PDKS devam kuralları
        </h2>
        <p className="text-sm text-muted-foreground">
          Cihaz senkronu gerekmez. Geçmiş günler değişmez.
        </p>
      </div>
      <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm">
          <strong>Şu an geçerli: </strong>
          {ruleSummary(rules.current, targets)}
          {rules.current && <span> ({rules.current.effectiveFrom})</span>}
        </p>
        {rules.future.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Gelecek sürümler</h3>
            <ul className="divide-y">
              {rules.future.map((rule) => (
                <li
                  key={rule._id}
                  className="flex items-start justify-between gap-3 py-2 text-sm"
                >
                  <p>
                    <strong>{rule.effectiveFrom}</strong> ·{" "}
                    {ruleSummary(rule, targets)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setConfirmation({ kind: "delete", rule });
                    }}
                    aria-label={`${rule.effectiveFrom} sürümünü sil`}
                  >
                    Sil
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details>
          <summary className="cursor-pointer text-sm">
            Geçmiş sürümler (son 20)
          </summary>
          <ul className="mt-2 space-y-2 text-sm">
            {rules.history.slice(0, 20).map((rule) => (
              <li key={rule._id}>
                {rule.effectiveFrom} · {ruleSummary(rule, targets)}
              </li>
            ))}
          </ul>
          {rules.history.length === 0 && (
            <p className="text-sm text-muted-foreground">Geçmiş sürüm yok.</p>
          )}
        </details>
      </div>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const parsed = pdksRuleSchema.safeParse(values);
          if (!parsed.success) {
            setError(
              parsed.error.issues[0]?.message ?? "Alanları kontrol edin.",
            );
            return;
          }
          if (
            rules.future.some(
              (rule) => rule.effectiveFrom === parsed.data.effectiveFrom,
            )
          )
            setConfirmation({ kind: "publish", values: parsed.data });
          else void save(parsed.data);
        }}
      >
        <h3 className="font-medium">Yeni sürüm</h3>
        <fieldset disabled={pending} className="space-y-4">
          <div className="grid gap-4 min-[761px]:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pdks-effective-from">Geçerlilik tarihi</Label>
              <Input
                id="pdks-effective-from"
                type="date"
                min={tomorrowInTurkey()}
                value={values.effectiveFrom}
                onChange={(event) =>
                  change({ effectiveFrom: event.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Türkiye saatine göre en erken yarın.
              </p>
            </div>
            <Choice
              id="pdks-punch-mode"
              label="Okutma kuralı"
              value={values.punchMode}
              options={[
                ["legacy", "Mevcut davranış (değişiklik yok)"],
                ["requirements", "Giriş-çıkış kuralları"],
              ]}
              onChange={(mode) => {
                if (mode === "legacy" || mode === "requirements")
                  change({
                    punchMode: mode,
                    ...(mode === "requirements" ? recommendedPunchRules : {}),
                  });
              }}
            />
          </div>
          {values.punchMode === "requirements" && (
            <div className="space-y-4 border-l-2 pl-4">
              <div className="flex flex-wrap gap-5">
                {(["requireCheckIn", "requireCheckOut"] as const).map((key) => (
                  <Label key={key} className="flex items-center gap-2">
                    <Checkbox
                      checked={values[key]}
                      onCheckedChange={(checked) =>
                        change({ [key]: checked === true })
                      }
                    />
                    {key === "requireCheckIn"
                      ? "Giriş zorunlu"
                      : "Çıkış zorunlu"}
                  </Label>
                ))}
              </div>
              <div className="grid gap-4 min-[761px]:grid-cols-2">
                <Choice
                  id="pdks-missing"
                  label="Zorunlu okutma eksikse"
                  value={values.missingRequiredPunch}
                  options={[
                    ["review", "İnceleme"],
                    ["absent", "Devamsız"],
                  ]}
                  onChange={(value) => {
                    if (value === "review" || value === "absent")
                      change({ missingRequiredPunch: value });
                  }}
                />
                <Choice
                  id="pdks-no-punch"
                  label="Hiç okutma yoksa"
                  value={values.noPunch}
                  options={[
                    ["absent", "Devamsız"],
                    ["review", "İnceleme"],
                  ]}
                  onChange={(value) => {
                    if (value === "review" || value === "absent")
                      change({ noPunch: value });
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tek yönlü günde süre hesaplanamaz. Yön bilgisi olmayan okutmalar
                İnceleme'ye düşer.
              </p>
            </div>
          )}
          <Choice
            id="pdks-checkpoints"
            label="PDKS'e sayılan noktalar"
            value={values.checkpointMode}
            options={[
              ["all", "Tüm kapı ve cihazlar"],
              ["selected", "Seçilenler"],
            ]}
            onChange={(mode) => {
              if (mode === "all" || mode === "selected")
                change({ checkpointMode: mode });
            }}
          />
          {values.checkpointMode === "selected" && (
            <div className="space-y-3">
              <p className="text-sm" aria-live="polite">
                Seçili nokta: {values.targets.length} / 500
              </p>
              <p className="text-xs text-muted-foreground">
                Mobil ve QR okutmalar Seçilenler modunda PDKS'e sayılmaz.
              </p>
              <div className="max-h-80 space-y-4 overflow-y-auto rounded-md border p-3">
                {targets.devices.map((device) => (
                  <div key={device.deviceId} className="space-y-2">
                    <h4 className="text-sm font-medium">{device.name}</h4>
                    <Label className="flex items-center gap-2">
                      <Checkbox
                        checked={values.targets.some(
                          (target) =>
                            target.targetType === "device" &&
                            target.deviceId === device.deviceId,
                        )}
                        onCheckedChange={(checked) =>
                          toggleTarget(
                            { targetType: "device", deviceId: device.deviceId },
                            checked === true,
                          )
                        }
                      />
                      Bu cihazın tüm geçişleri
                    </Label>
                    {targets.doors
                      .filter((door) => door.deviceId === device.deviceId)
                      .map((door) => (
                        <div key={door.doorId} className="pl-5">
                          <Label className="flex items-center gap-2">
                            <Checkbox
                              disabled={!door.selectable}
                              checked={values.targets.some(
                                (target) =>
                                  target.targetType === "door" &&
                                  target.doorId === door.doorId,
                              )}
                              aria-describedby={
                                door.reason
                                  ? `pdks-reason-${door.doorId}`
                                  : undefined
                              }
                              onCheckedChange={(checked) => {
                                if (door.selectable)
                                  toggleTarget(
                                    {
                                      targetType: "door",
                                      deviceId: device.deviceId,
                                      doorId: door.doorId,
                                    },
                                    checked === true,
                                  );
                              }}
                            />
                            {door.name}
                          </Label>
                          {door.reason && (
                            <p
                              id={`pdks-reason-${door.doorId}`}
                              className="mt-1 text-xs text-muted-foreground"
                            >
                              {door.reason}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                ))}
                {targets.doors
                  .filter((door) => !door.deviceId)
                  .map((door) => (
                    <div key={door.doorId}>
                      <Label className="flex items-center gap-2">
                        <Checkbox disabled />
                        {door.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {door.reason ?? "Kapıya bağlı cihaz yok."}
                      </p>
                    </div>
                  ))}
                {targets.devices.length === 0 && targets.doors.length === 0 && (
                  <p className="text-sm">Seçilebilecek kapı veya cihaz yok.</p>
                )}
              </div>
            </div>
          )}
          <Button
            type="submit"
            disabled={
              pending ||
              (values.checkpointMode === "selected" &&
                (values.targets.length === 0 || values.targets.length > 500))
            }
          >
            {pending ? "Yayınlanıyor…" : "Yeni sürümü yayınla"}
          </Button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm">
          {success}
        </p>
      )}
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "delete"
                ? "Gelecek sürüm silinsin mi?"
                : "Bu tarihteki sürüm değiştirilsin mi?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "delete"
                ? `${confirmation.rule.effectiveFrom} tarihli gelecek sürüm silinecek.`
                : `${confirmation?.values.effectiveFrom ?? ""} tarihindeki yayın, o tarihteki sürümün yerine geçer.`}{" "}
              Geçmiş günler değişmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                if (!confirmation || pending) return;
                if (confirmation.kind === "publish") {
                  void save(confirmation.values);
                  return;
                }
                setPending(true);
                setError("");
                setSuccess("");
                void remove({ ruleVersionId: confirmation.rule._id })
                  .then(() => {
                    setConfirmation(null);
                    setSuccess("Gelecek sürüm silindi.");
                  })
                  .catch((cause) => setError(errorMessage(cause)))
                  .finally(() => setPending(false));
              }}
            >
              {pending
                ? "Kaydediliyor…"
                : confirmation?.kind === "delete"
                  ? "Sürümü sil"
                  : "Yerine yayınla"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
