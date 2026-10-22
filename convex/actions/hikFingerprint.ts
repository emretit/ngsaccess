"use node";

import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { authedAction } from "../lib/customFunctions";
import { isManager } from "../lib/auth";
import { captureFingerprintLive, addFingerprintToDevice, deleteFingerprintFromDevice } from "../lib/gateway/biometrics";

function safeDeviceError(error?: string): string {
  if (/timeout|timed?\s*out/i.test(error ?? "")) return "Cihaz yanıtı zaman aşımına uğradı. Parmağınızı sensöre yerleştirip yeniden deneyin.";
  if (/notSupport|notImplement|unsupported/i.test(error ?? "")) return "Bu cihaz parmak izi kaydını desteklemiyor";
  return "Cihaz parmak izi işlemini tamamlayamadı. Cihaz bağlantısını ve parmağın sensöre yerleşimini kontrol edip yeniden deneyin.";
}

export const enrollFingerprintOnDevice = authedAction({
  args: { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), attemptId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!isManager(ctx.user)) throw new ConvexError("Bu işlem için yönetici yetkisi gerekiyor.");
    if (!Number.isInteger(args.fingerNo) || args.fingerNo < 1 || args.fingerNo > 10) throw new ConvexError("Parmak numarası 1–10 arasında tam sayı olmalıdır.");
    const target: { employee: Doc<"employees">; device: Doc<"devices"> } = await ctx.runQuery(internal.fingerprintEnrollment.getTargetInternal, { employeeId: args.employeeId, deviceId: args.deviceId, userId: ctx.user._id });
    await ctx.runQuery(internal.privacyBiometric.assertBiometricDeviceAllowed, { deviceId: args.deviceId });
    const devIndex = target.device.hikDevIndex;
    if (!devIndex) throw new ConvexError("Cihaz gateway bağlantısı bulunamadı.");
    const attemptId: string = args.attemptId ?? await ctx.runMutation(api.fingerprintEnrollment.beginEnrollment, { employeeId: args.employeeId, deviceId: args.deviceId, fingerNo: args.fingerNo });
    const attempt = { employeeId: args.employeeId, deviceId: args.deviceId, fingerNo: args.fingerNo, attemptId };
    let downloaded = false;
    try {
      if (!(await ctx.runQuery(internal.fingerprintEnrollment.getAttempt, attempt))) throw new ConvexError("Parmak izi kaydı iptal edildi.");
      const capture = await captureFingerprintLive(devIndex, { fingerPrintID: args.fingerNo });
      if (!capture.ok || !capture.fingerData) throw new ConvexError(safeDeviceError(capture.error));
      // Recheck consent, module, project, group and card after the sensor wait.
      const current: { employee: Doc<"employees">; device: Doc<"devices"> } = await ctx.runQuery(internal.fingerprintEnrollment.getTargetInternal, { employeeId: args.employeeId, deviceId: args.deviceId, userId: ctx.user._id });
      if (current.employee.cardNumber.trim() !== target.employee.cardNumber.trim() || !(await ctx.runQuery(internal.fingerprintEnrollment.getAttempt, attempt))) throw new ConvexError("Parmak izi kaydı iptal edildi veya kart numarası değişti.");
      // The template exists only here, between capture and download to this device.
      downloaded = true; // A failed/timeout response may still have reached the device.
      const result = await addFingerprintToDevice(devIndex, { employeeNo: target.employee.cardNumber.trim(), fingerPrintID: args.fingerNo, fingerData: capture.fingerData });
      capture.fingerData = undefined;
      if (!result.ok) throw new ConvexError(safeDeviceError(result.error));
      await ctx.runMutation(internal.fingerprintEnrollment.upsert, { ...attempt, enrolledBy: ctx.user._id, expectedCardNumber: target.employee.cardNumber });
    } catch (error) {
      let cleanupFailed = false;
      if (downloaded) {
        try {
          const cleanup = await deleteFingerprintFromDevice(devIndex, target.employee.cardNumber.trim(), args.fingerNo);
          cleanupFailed = !cleanup.ok;
        } catch { cleanupFailed = true; }
      }
      await ctx.runMutation(internal.fingerprintEnrollment.finishAttempt, { ...attempt, clearEnrolled: downloaded && !cleanupFailed });
      await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId: args.deviceId, label: "Parmak izi kaydı: başarısız", ok: false });
      if (cleanupFailed) throw new ConvexError("İşlem tamamlanamadı ve cihazdaki kayıt temizlenemedi. Cihazdan parmak izini silip yeniden deneyin.");
      // Never forward transport exceptions or response bodies: they may contain a template.
      throw error instanceof ConvexError ? error : new ConvexError(safeDeviceError());
    }
    await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId: args.deviceId, label: "Parmak izi kaydı: komut iletildi", ok: true });
    return null;
  },
});

export const removeFingerprintFromDevice = authedAction({
  args: { enrollmentId: v.id("deviceFingerprintEnrollments") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!isManager(ctx.user)) throw new ConvexError("Bu işlem için yönetici yetkisi gerekiyor.");
    const row: Doc<"deviceFingerprintEnrollments"> | null = await ctx.runQuery(internal.fingerprintEnrollment.getInternal, args);
    if (!row) throw new ConvexError("Parmak izi kaydı bulunamadı.");
    if ((row.pendingUntil ?? 0) > Date.now()) throw new ConvexError("Önce devam eden parmak izi işlemini iptal edin ve bitmesini bekleyin.");
    const { employee, device }: { employee: Doc<"employees">; device: Doc<"devices"> } = await ctx.runQuery(internal.fingerprintEnrollment.getTargetInternal, { employeeId: row.employeeId, deviceId: row.deviceId, userId: ctx.user._id, removing: true });
    if (!device.hikDevIndex) throw new ConvexError("Cihaz gateway bağlantısı bulunamadı.");
    try {
      // Privacy removal remains available after consent revocation or module shutdown.
      const result = await deleteFingerprintFromDevice(device.hikDevIndex, row.deletionEmployeeNo ?? employee.cardNumber.trim(), row.fingerNo);
      if (!result.ok) throw new ConvexError(safeDeviceError(result.error));
      await ctx.runMutation(internal.fingerprintEnrollment.remove, args);
    } catch {
      await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId: row.deviceId, label: "Parmak izi silme: başarısız", ok: false });
      throw new ConvexError("Parmak izi cihazdan silinemedi. Cihaz bağlantısını kontrol edip yeniden deneyin.");
    }
    await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId: row.deviceId, label: "Parmak izi silme: komut iletildi", ok: true });
    return null;
  },
});


// Scheduled snapshots contain device identity and metadata only, never templates.
export const purgeFingerprintsOnDevices = internalAction({
  args: { snapshots: v.array(v.object({
    enrollmentId: v.id("deviceFingerprintEnrollments"), deviceId: v.id("devices"),
    fingerNo: v.number(), employeeNo: v.string(),
  })) },
  returns: v.null(),
  handler: async (ctx, { snapshots }): Promise<null> => {
    for (const snapshot of snapshots) {
      let ok = false;
      try {
        const row: Doc<"deviceFingerprintEnrollments"> | null = await ctx.runQuery(internal.fingerprintEnrollment.getInternal, { enrollmentId: snapshot.enrollmentId });
        // A duplicate job must not erase a later enrollment after the old row is gone.
        if (!row || row.deletionEmployeeNo !== snapshot.employeeNo) continue;
        const devIndex: string | null = await ctx.runQuery(internal.fingerprintEnrollment.getPurgeDevice, { deviceId: snapshot.deviceId });
        if (devIndex) {
          const result = await deleteFingerprintFromDevice(devIndex, snapshot.employeeNo, snapshot.fingerNo);
          if (result.ok) {
            await ctx.runMutation(internal.fingerprintEnrollment.remove, { enrollmentId: snapshot.enrollmentId });
            ok = true;
          }
        }
      } catch { /* Keep metadata for retry; transport details may contain biometric data. */ }
      await ctx.runMutation(internal.deviceEvents.recordOperationInternal, {
        deviceId: snapshot.deviceId, label: ok ? "Parmak izi silme: komut iletildi" : "Parmak izi silme: başarısız", ok,
      });
    }
    return null;
  },
});
