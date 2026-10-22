"use node";

import { ConvexError, v } from "convex/values";
import { internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { assertTemplateKey, encryptTemplate, decryptTemplate } from "../lib/fingerprintCrypto";
import { authedAction } from "../lib/customFunctions";
import { captureFingerprintLive, addFingerprintToDevice, deleteFingerprintFromDevice } from "../lib/gateway/biometrics";

/** Okuyucu durum kodları (biometrics.ts `fpRecvStatusN`); ham cihaz yanıtı kullanıcıya gitmez. */
const FP_RECV_STATUS_MESSAGES: Readonly<Record<string, string>> = {
  "0": "Cihaz parmak izi okuyucusuna bağlanamadı. Cihazı kontrol edip yeniden deneyin.",
  "2": "Cihazın parmak izi modülü çevrimdışı.",
  "3": "Parmak izi kalitesi düşük. Parmağı temizleyip sensöre düz yerleştirerek yeniden deneyin.",
  "4": "Cihazın parmak izi belleği dolu.",
  "5": "Bu parmak izi cihazda zaten kayıtlı (başka bir kişi adına olabilir). Farklı bir parmak deneyin ya da cihazdaki eski kaydı silin.",
  "6": "Bu parmak numarası cihazda zaten dolu. Farklı bir parmak seçin ya da önce mevcut kaydı silin.",
  "7": "Geçersiz parmak numarası.",
};

function safeDeviceError(error?: string): string {
  const recvStatus = /fpRecvStatus(\d+)/.exec(error ?? "")?.[1];
  if (recvStatus !== undefined && FP_RECV_STATUS_MESSAGES[recvStatus]) return FP_RECV_STATUS_MESSAGES[recvStatus];
  if (/timeout|timed?\s*out/i.test(error ?? "")) return "Cihaz yanıtı zaman aşımına uğradı. Parmağınızı sensöre yerleştirip yeniden deneyin.";
  if (/notSupport|notImplement|unsupported/i.test(error ?? "")) return "Bu cihaz parmak izi kaydını desteklemiyor";
  return "Cihaz parmak izi işlemini tamamlayamadı. Cihaz bağlantısını ve parmağın sensöre yerleşimini kontrol edip yeniden deneyin.";
}

export const enrollFingerprintOnDevice = authedAction({
  args: { employeeId: v.id("employees"), deviceId: v.id("devices"), fingerNo: v.number(), attemptId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!Number.isInteger(args.fingerNo) || args.fingerNo < 1 || args.fingerNo > 10) throw new ConvexError("Parmak numarası 1–10 arasında tam sayı olmalıdır.");
    const target: { employee: Doc<"employees">; device: Doc<"devices"> } = await ctx.runQuery(internal.fingerprintEnrollment.getTargetInternal, { employeeId: args.employeeId, deviceId: args.deviceId, userId: ctx.user._id });
    await ctx.runQuery(internal.privacyBiometric.assertBiometricDeviceAllowed, { deviceId: args.deviceId });
    const devIndex = target.device.hikDevIndex;
    if (!devIndex) throw new ConvexError("Cihaz gateway bağlantısı bulunamadı.");
    await assertTemplateKey();
    const attemptId: string = args.attemptId ?? await ctx.runMutation(api.fingerprintEnrollment.beginEnrollment, { employeeId: args.employeeId, deviceId: args.deviceId, fingerNo: args.fingerNo });
    const attempt = { employeeId: args.employeeId, deviceId: args.deviceId, fingerNo: args.fingerNo, attemptId };
    let downloaded = false;
    let sourceSaved = false;
    let capture: Awaited<ReturnType<typeof captureFingerprintLive>> | undefined;
    try {
      if (!(await ctx.runQuery(internal.fingerprintEnrollment.getAttempt, attempt))) throw new ConvexError("Parmak izi kaydı iptal edildi.");
      capture = await captureFingerprintLive(devIndex, { fingerPrintID: args.fingerNo }).catch(() => { throw new ConvexError(safeDeviceError()); });
      if (!capture.ok || !capture.fingerData) throw new ConvexError(safeDeviceError(capture.error));
      // Recheck consent, module, project, group and card after the sensor wait.
      const current: { employee: Doc<"employees">; device: Doc<"devices"> } = await ctx.runQuery(internal.fingerprintEnrollment.getTargetInternal, { employeeId: args.employeeId, deviceId: args.deviceId, userId: ctx.user._id });
      if (current.employee.cardNumber.trim() !== target.employee.cardNumber.trim() || !(await ctx.runQuery(internal.fingerprintEnrollment.getAttempt, attempt))) throw new ConvexError("Parmak izi kaydı iptal edildi veya kart numarası değişti.");
      // Plaintext stays in action memory only.
      downloaded = true; // A failed/timeout response may still have reached the device.
      const result = await addFingerprintToDevice(devIndex, { employeeNo: target.employee.cardNumber.trim(), fingerPrintID: args.fingerNo, fingerData: capture.fingerData }).catch(() => { throw new ConvexError(safeDeviceError()); });
      if (!result.ok) throw new ConvexError(safeDeviceError(result.error));
      await ctx.runMutation(internal.fingerprintEnrollment.upsert, { ...attempt, enrolledBy: ctx.user._id, expectedCardNumber: target.employee.cardNumber });
      sourceSaved = true;
      const encrypted = await encryptTemplate(capture.fingerData, `${args.employeeId}:${args.fingerNo}`);
      await ctx.runMutation(internal.employeeFingerprints.upsertEncrypted, { employeeId: args.employeeId, fingerNo: args.fingerNo, sourceDeviceId: args.deviceId, enrolledBy: ctx.user._id, expectedCardNumber: target.employee.cardNumber, ...encrypted });
      capture.fingerData = undefined;
      await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.pushFingerprintToDevices, { employeeId: args.employeeId, fingerNo: args.fingerNo, excludeDeviceId: args.deviceId });
    } catch (error) {
      if (sourceSaved) {
        await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId: args.deviceId, label: "Parmak izi merkezi kayıt: başarısız", ok: false });
        throw new ConvexError("Cihazda kaydedildi, sisteme kaydedilemedi");
      }
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
    } finally { if (capture) capture.fingerData = undefined; }
    await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId: args.deviceId, label: "Parmak izi kaydı: komut iletildi", ok: true });
    return null;
  },
});

export const removeFingerprintFromDevice = authedAction({
  args: { enrollmentId: v.id("deviceFingerprintEnrollments") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const row: Doc<"deviceFingerprintEnrollments"> | null = await ctx.runQuery(internal.fingerprintEnrollment.getInternal, args);
    if (!row) throw new ConvexError("Parmak izi kaydı bulunamadı.");
    if ((row.pendingUntil ?? 0) > Date.now()) throw new ConvexError("Önce devam eden parmak izi işlemini iptal edin ve bitmesini bekleyin.");
    const { employee, device }: { employee: Doc<"employees">; device: Doc<"devices"> } = await ctx.runQuery(internal.fingerprintEnrollment.getTargetInternal, { employeeId: row.employeeId, deviceId: row.deviceId, userId: ctx.user._id, removing: true });
    if (!device.hikDevIndex) throw new ConvexError("Cihaz gateway bağlantısı bulunamadı.");
    await ctx.runMutation(api.fingerprintEnrollment.removeFingerprint, { employeeId: row.employeeId, fingerNo: row.fingerNo });
    try {
      // Privacy removal remains available after consent revocation or module shutdown.
      const result = await deleteFingerprintFromDevice(device.hikDevIndex, row.deletionEmployeeNo ?? employee.cardNumber.trim(), row.fingerNo);
      if (!result.ok) throw new ConvexError(safeDeviceError(result.error));
      await ctx.runMutation(internal.fingerprintEnrollment.remove, args);
    } catch {
      await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId: row.deviceId, label: "Parmak izi silme: başarısız (yeniden denenecek)", ok: false });
      throw new ConvexError("Sistemden silindi; cihazlardan silme yeniden denenecek");
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
  })), attempts: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, { snapshots, attempts = 0 }): Promise<null> => {
    const failed: typeof snapshots = [];
    const inFlight: typeof snapshots = [];
    for (const snapshot of snapshots) {
      let ok = false;
      try {
        const row: Doc<"deviceFingerprintEnrollments"> | null = await ctx.runQuery(internal.fingerprintEnrollment.getInternal, { enrollmentId: snapshot.enrollmentId });
        // A duplicate job must not erase a later enrollment after the old row is gone.
        if (!row || row.deletionEmployeeNo !== snapshot.employeeNo) continue;
        // A privacy purge must wait for a reserved gateway write to settle.
        if ((row.pendingUntil ?? 0) > Date.now()) { inFlight.push(snapshot); continue; }
        const devIndex: string | null = await ctx.runQuery(internal.fingerprintEnrollment.getPurgeDevice, { deviceId: snapshot.deviceId });
        if (devIndex) {
          const result = await deleteFingerprintFromDevice(devIndex, snapshot.employeeNo, snapshot.fingerNo);
          if (result.ok) {
            await ctx.runMutation(internal.fingerprintEnrollment.remove, { enrollmentId: snapshot.enrollmentId });
            ok = true;
            await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.pushFingerprintToDevices, { employeeId: row.employeeId, fingerNo: row.fingerNo, deviceIds: [row.deviceId] });
          }
        }
      } catch { /* Keep metadata for retry; transport details may contain biometric data. */ }
      if (!ok) failed.push(snapshot);
      try {
        await ctx.runMutation(internal.deviceEvents.recordOperationInternal, {
          deviceId: snapshot.deviceId, label: ok ? "Parmak izi silme: komut iletildi" : "Parmak izi silme: başarısız (yeniden denenecek)", ok,
        });
      } catch { /* Retry scheduling remains independent of event delivery. */ }
    }
    if (inFlight.length) await ctx.scheduler.runAfter(180_000, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots: inFlight, attempts });
    const delays = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 43_200_000, 43_200_000];
    if (failed.length && attempts < delays.length) await ctx.scheduler.runAfter(delays[attempts], internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots: failed, attempts: attempts + 1 });
    return null;
  },
});


/** Only encrypted rows cross function boundaries; plaintext exists per gateway call. */
export const pushFingerprintToDevices = internalAction({
  args: { employeeId: v.id("employees"), fingerNo: v.optional(v.number()), deviceIds: v.optional(v.array(v.id("devices"))), excludeDeviceId: v.optional(v.id("devices")), force: v.optional(v.boolean()), retrying: v.optional(v.boolean()) },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const templates: Doc<"employeeFingerprints">[] = await ctx.runQuery(internal.employeeFingerprints.listInternal, { employeeId: args.employeeId, fingerNo: args.fingerNo });
    if (!templates.length) return { ok: true };
    const devices: Id<"devices">[] = await ctx.runQuery(internal.fingerprintEnrollment.getPushDevices, { employeeId: args.employeeId });
    let allOk = true;
    for (const deviceId of devices) {
      if (deviceId === args.excludeDeviceId || (args.deviceIds && !args.deviceIds.includes(deviceId))) continue;
      for (const template of templates) {
        let ok = false;
        let reservation: { enrollmentId: Id<"deviceFingerprintEnrollments">; attemptId: string } | undefined;
        let employeeNo: string | undefined;
        try {
          const target: { employee: Doc<"employees">; device: Doc<"devices"> } | null = await ctx.runQuery(internal.fingerprintEnrollment.getPushTarget, { employeeId: args.employeeId, deviceId });
          if (!target?.device.hikDevIndex || !template.enrolledBy) { allOk = false; continue; }
          const reserved: { current: true } | { enrollmentId: Id<"deviceFingerprintEnrollments">; attemptId: string } | null = await ctx.runMutation(internal.fingerprintEnrollment.beginPush, { employeeId: args.employeeId, deviceId, fingerNo: template.fingerPrintID, templateId: template._id, addedAt: template.addedAt, expectedCardNumber: target.employee.cardNumber, force: args.force });
          if (reserved && "current" in reserved) continue;
          if (!reserved) { allOk = false; continue; }
          reservation = reserved;
          employeeNo = target.employee.cardNumber.trim();
          let plain: string | undefined = await decryptTemplate(template, `${args.employeeId}:${template.fingerPrintID}`);
          try {
            const result = await addFingerprintToDevice(target.device.hikDevIndex, { employeeNo, fingerPrintID: template.fingerPrintID, fingerData: plain });
            if (!result.ok) throw new Error();
          } finally { plain = undefined; }
          await ctx.runMutation(internal.fingerprintEnrollment.recordPush, { employeeId: args.employeeId, deviceId, fingerNo: template.fingerPrintID, templateId: template._id, addedAt: template.addedAt, expectedCardNumber: target.employee.cardNumber, enrolledBy: template.enrolledBy, attemptId: reservation.attemptId });
          ok = true;
        } catch { /* Never expose gateway errors or template contents. */ }
        if (!ok) {
          allOk = false;
          try {
            if (reservation && employeeNo !== undefined) await ctx.runMutation(internal.fingerprintEnrollment.queuePushCleanup, { enrollmentId: reservation.enrollmentId, employeeNo });
          } catch { /* The pre-send tombstone remains recoverable by the daily sweep. */ }
          try {
            if (!args.retrying) await ctx.runMutation(internal.hikvisionSync.recordSyncFailure, { deviceId, operation: "addFingerprint", lastError: "Parmak izi gönderilemedi", payload: { employeeId: args.employeeId, fingerPrintID: template.fingerPrintID } });
          } catch { /* One failed queue write must not prevent delivery to other devices. */ }
        }
        try {
          await ctx.runMutation(internal.deviceEvents.recordOperationInternal, { deviceId, label: ok ? "Parmak izi gönderimi: komut iletildi" : "Parmak izi gönderimi: başarısız", ok });
        } catch { /* A failed event write must not block other devices. */ }
      }
    }
    // A requested device disappearing from scope cannot count as a successful retry.
    if (args.deviceIds?.some(id => !devices.includes(id))) allOk = false;
    return { ok: allOk };
  },
});

export const resendFingerprint = authedAction({
  args: { employeeId: v.id("employees"), fingerNo: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!Number.isInteger(args.fingerNo) || args.fingerNo < 1 || args.fingerNo > 10) throw new ConvexError("Parmak numarası 1–10 arasında tam sayı olmalıdır.");
    await ctx.runQuery(internal.fingerprintEnrollment.authorizeEmployee, { employeeId: args.employeeId, userId: ctx.user._id });
    await ctx.runMutation(api.fingerprintEnrollment.auditResend, args);
    await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.pushFingerprintToDevices, { ...args, force: true });
    return null;
  },
});

export const removeFingerprint = authedAction({
  args: { employeeId: v.id("employees"), fingerNo: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runMutation(api.fingerprintEnrollment.removeFingerprint, args);
    return null;
  },
});
