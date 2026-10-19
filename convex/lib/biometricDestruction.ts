import { z } from "zod";
import { v } from "convex/values";

export const DESTRUCTION_BATCH_SIZE = 1;
export const PREVIEW_LIMIT = 500;
export const DEVICE_TARGET_LIMIT = 50;
export const MAX_PENDING_DEVICE_OPS = 500;
export const DEVICE_OFFLINE_MS = 10 * 60 * 1000;
export function deviceCheckDelay(attempt: number): number {
  return attempt === 0 ? 30_000 : attempt < 3 ? 5 * 60_000 : 30 * 60_000;
}
export const DEVICE_WAIT_MS = 24 * 60 * 60 * 1000;
export const kindSchema = z.enum(["face", "fingerprint"]);
export type BiometricKind = z.infer<typeof kindSchema>;

export function normalizeKinds(kinds: readonly BiometricKind[]): BiometricKind[] {
  return (["face", "fingerprint"] as const).filter(kind => kinds.includes(kind));
}

export function validateDestructionInput(projectName: string, confirmText: string, reason: string, kinds: readonly BiometricKind[]) {
  if (!kinds.length || kinds.some(kind => !kindSchema.safeParse(kind).success)) return "En az bir biyometrik tür seçin.";
  if (!projectName || confirmText !== projectName) return "Onay için proje adını tam olarak yazın.";
  if (reason.trim().length < 3 || reason.trim().length > 500) return "Gerekçe 3–500 karakter olmalıdır.";
  return null;
}

export function splitDestructionBatches<T>(items: readonly T[], size = DESTRUCTION_BATCH_SIZE): T[][] {
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new Error("Toplu işlem boyutu 1–100 olmalıdır.");
  const batches: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) batches.push(items.slice(offset, offset + size));
  return batches;
}

export function summarizePreview(
  faces: readonly { employeeId: string; pictureStorageId: string }[],
  fingerprints: readonly { employeeId: string }[],
  kinds: readonly BiometricKind[],
  limit = PREVIEW_LIMIT,
) {
  const selectedFaces = kinds.includes("face") ? faces.slice(0, limit) : [];
  const selectedFingers = kinds.includes("fingerprint") ? fingerprints.slice(0, limit) : [];
  return {
    faceCount: selectedFaces.length,
    fingerprintCount: selectedFingers.length,
    employeeCount: new Set([...selectedFaces, ...selectedFingers].map(row => row.employeeId)).size,
    storageFileCount: new Set(selectedFaces.map(row => row.pictureStorageId)).size,
    capped: (kinds.includes("face") && faces.length > limit) || (kinds.includes("fingerprint") && fingerprints.length > limit),
  };
}

export const destructionStateSchema = z.object({
  version: z.literal(1),
  projectName: z.string(),
  kinds: z.array(kindSchema),
  reason: z.string(),
  startedAt: z.number(),
  finishedAt: z.number().nullable(),
  status: z.enum(["running", "waitingDevices", "completed", "failed"]),
  phase: kindSchema,
  cursor: z.string().nullable(),
  scan: z.enum(["project", "legacy"]).default("project"),
  employeeCursor: z.string().nullable().default(null),
  legacyEmployeeId: z.string().nullable().default(null),
  pendingOpIds: z.array(z.string()).max(MAX_PENDING_DEVICE_OPS).default([]),
  deviceCheckAttempt: z.number().default(0),
  deviceCheckDeadline: z.number().nullable().default(null),
  batch: z.number(),
  heartbeatAt: z.number(),
  deletedFaces: z.number(),
  deletedFingerprints: z.number(),
  deletedFiles: z.number(),
  deviceOperations: z.number(),
  deviceFailures: z.number(),
  deviceUnconfirmed: z.number(),
  pendingDeviceChecks: z.number(),
  skippedChanged: z.number(),
  error: z.string().nullable(),
});
export type DestructionState = z.infer<typeof destructionStateSchema>;

export function initialDestructionState(projectName: string, kinds: BiometricKind[], reason: string, now: number): DestructionState {
  const normalized = normalizeKinds(kinds);
  return {
    version: 1, projectName, kinds: normalized, reason: reason.trim(), startedAt: now, finishedAt: null,
    scan: "project", employeeCursor: null, legacyEmployeeId: null, pendingOpIds: [], deviceCheckAttempt: 0, deviceCheckDeadline: null,
    status: "running", phase: normalized[0] ?? "face", cursor: null, batch: 0, heartbeatAt: now,
    deletedFaces: 0, deletedFingerprints: 0, deletedFiles: 0, deviceOperations: 0,
    deviceFailures: 0, deviceUnconfirmed: 0, pendingDeviceChecks: 0, skippedChanged: 0, error: null,
  };
}

export function destructionReport(projectId: string, state: DestructionState) {
  return {
    projectId, kinds: state.kinds, silinenYuz: state.deletedFaces, silinenParmak: state.deletedFingerprints,
    silinenDosya: state.deletedFiles, cihazOpSayisi: state.deviceOperations, cihazHata: state.deviceFailures,
    cihazDogrulanamayan: state.deviceUnconfirmed, baslangic: state.startedAt, bitis: state.finishedAt,
    gerekce: state.reason, durum: state.status, degistigiIcinAtlanan: state.skippedChanged,
  };
}

export function destructionSummary(state: Pick<DestructionState, "deletedFaces" | "deletedFingerprints" | "deletedFiles" | "deviceOperations" | "deviceFailures" | "deviceUnconfirmed">) {
  return `${state.deletedFaces} yüz, ${state.deletedFingerprints} parmak izi ve ${state.deletedFiles} dosya Convex'ten silindi. Cihaz işlemi: ${state.deviceOperations}; cihaz silmesi başarısız: ${state.deviceFailures}; cihaz sonucu doğrulanamadı: ${state.deviceUnconfirmed}.${state.deviceOperations === 0 ? " Cihazlardaki şablonlar ayrıca silinmeli." : ""}`;
}

export const targetValidator = v.object({
  deviceId: v.id("devices"), hikDevIndex: v.optional(v.string()),
  hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))),
});
export const itemValidator = v.object({
  kind: v.union(v.literal("face"), v.literal("fingerprint")), employeeId: v.id("employees"),
  faceId: v.optional(v.id("employeeFaces")), fingerprintId: v.optional(v.id("employeeFingerprints")),
  storageId: v.optional(v.id("_storage")), fingerPrintID: v.optional(v.number()),
  addedAt: v.number(), cardNumber: v.string(),
  targets: v.array(targetValidator), unconfirmed: v.number(),
});

