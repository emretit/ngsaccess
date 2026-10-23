import { z } from "zod";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

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
const readerId = z.string().min(1).transform(value => value as Id<"readers">);
const pointType = z.enum(["both", "entry", "exit"]).optional();
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
    calculationMode: z.enum(["firstLast", "eachPunch"]).optional(),
    minPunchIntervalMinutes: z.number().finite().min(0, "Aralık 0–60 dakika olmalı.").max(60, "Aralık 0–60 dakika olmalı.").optional(),
    punchMode: z.enum(["legacy", "requirements"]),
    requireCheckIn: z.boolean(),
    requireCheckOut: z.boolean(),
    missingRequiredPunch: z.enum(["review", "absent"]),
    noPunch: z.enum(["absent", "review"]),
    checkpointMode: z.enum(["all", "selected"]),
    targets: z
      .array(
        z.discriminatedUnion("targetType", [
          z.object({ targetType: z.literal("device"), deviceId, pointType }),
          z.object({ targetType: z.literal("door"), deviceId, doorId, pointType }),
          z.object({ targetType: z.literal("reader"), deviceId, doorId, readerId, pointType }),
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
    ...(values.calculationMode !== undefined ? { calculationMode: values.calculationMode } : {}),
    ...(values.minPunchIntervalMinutes !== undefined ? { minPunchIntervalMinutes: values.minPunchIntervalMinutes } : {}),
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
export type Rule = NonNullable<
  FunctionReturnType<typeof api.pdksRules.getRules>["current"]
>;
export type Targets = FunctionReturnType<
  typeof api.pdksRules.listCheckpointTargets
>;

export const pointTypeLabels = { both: "Giriş ve çıkış", entry: "Yalnız giriş", exit: "Yalnız çıkış" } as const;
export function checkpointKey(target: { targetType: string; deviceId: string; doorId?: string; readerId?: string }): string {
  return `${target.targetType}:${target.targetType === "reader" ? target.readerId : target.targetType === "door" ? target.doorId : target.deviceId}`;
}
export function checkpointSummary(selected: readonly { targetType: string; deviceId: string; doorId?: string; readerId?: string; pointType?: keyof typeof pointTypeLabels }[], targets?: Targets): string {
  return selected.map(target => {
    const name = target.targetType === "reader"
      ? targets?.readers?.find(reader => reader.readerId === target.readerId)?.name ?? "Okuyucu (artık listede yok)"
      : target.targetType === "door"
      ? targets?.doors.find(door => door.doorId === target.doorId)?.name ?? "Kapı (artık listede yok)"
      : `${targets?.devices.find(device => device.deviceId === target.deviceId)?.name ?? "Cihaz (artık listede yok)"} — tüm geçişler`;
    return `${name}: ${pointTypeLabels[target.pointType ?? "both"]}`;
  }).join(", ");
}

export function calculationSummary(rule: { calculationMode?: "firstLast" | "eachPunch"; minPunchIntervalMinutes?: number }): string {
  return `${rule.calculationMode === "eachPunch" ? "Her giriş-çıkışı topla" : "İlk giriş–son çıkış"} · Tekrar okutma aralığı: ${rule.minPunchIntervalMinutes ?? 1} dk`;
}
export function ruleSummary(
  rule: Rule | null,
  targets: Targets | undefined,
): string {
  if (!rule) return "Mevcut davranış · Tüm kapı ve cihazlar";
  const mode =
    rule.punchMode === "legacy"
      ? "Mevcut davranış"
      : `Giriş ${rule.requireCheckIn ? "zorunlu" : "isteğe bağlı"}, çıkış ${rule.requireCheckOut ? "zorunlu" : "isteğe bağlı"}; eksik zorunlu okutma: ${rule.missingRequiredPunch === "review" ? "İnceleme" : "Devamsız"}; hiç okutma yoksa: ${rule.noPunch === "review" ? "İnceleme" : "Devamsız"}`;
  const points =
    rule.checkpointMode === "all"
      ? "Tüm kapı ve cihazlar"
      : `${rule.targets.length} seçili nokta: ${checkpointSummary(rule.targets, targets)}`;
  return `${mode} · ${points} · ${calculationSummary(rule)}`;
}

export type RuleConfirmation =
  | { kind: "publish"; values: PdksRuleValues }
  | { kind: "delete"; rule: Rule }
  | null;
