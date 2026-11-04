import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { enqueueLocalBridgeOperationInTransaction } from "../hikvisionSync";

/** Erase only the biometric purpose; a separately referenced profile photo survives. */
export async function purgeFaceConsent(ctx: MutationCtx, employee: Doc<"employees">) {
  const faces = await ctx.db.query("employeeFaces")
    .withIndex("by_employee", q => q.eq("employeeId", employee._id)).take(101);
  if (faces.length > 100) throw new Error("Yüz kayıtları işlem sınırını aşıyor; destek ile iletişime geçin.");
  let deletedFiles = 0;
  let retainedPhotoFiles = 0;
  const storageIds = new Set(faces.map(face => face.pictureStorageId));
  for (const storageId of storageIds) {
    const photo = await ctx.db.query("employees")
      .withIndex("by_photo_storage", q => q.eq("photoStorageId", storageId)).first();
    if (photo) retainedPhotoFiles++;
    else if (await ctx.db.system.get(storageId)) {
      await ctx.storage.delete(storageId);
      deletedFiles++;
    }
  }
  for (const face of faces) await ctx.db.delete(face._id);

  // As in project destruction, include former device copies after rule removal.
  // Do not enumerate devices of unrelated projects for legacy unassigned people.
  const devices = employee.projectId ? await ctx.db.query("devices")
    .withIndex("by_project", q => q.eq("projectId", employee.projectId)).take(51) : [];
  if (devices.length > 50) throw new Error("Projedeki cihaz sayısı güvenli işlem sınırını (50) aşıyor; destek ile iletişime geçin.");
  let queued = 0;
  for (const device of devices) {
    if (device.brand !== "hikvision") continue;
    // A queued upload may contain the image itself. Deleting storage alone cannot
    // prevent that old operation from restoring the face after erasure.
    for (const status of ["pending", "processing", "failed"] as const) {
      const operations = await ctx.db.query("hikPendingOperations")
        .withIndex("by_device_status", q => q.eq("deviceId", device._id).eq("status", status)).take(101);
      if (operations.length > 100) throw new Error("Cihaz işlem kuyruğu sınırı aşıldı; yüz rızasını iptal etmek için destek ile iletişime geçin.");
      for (const operation of operations) {
        const payload: unknown = operation.payload;
        if (operation.operation !== "addFace" || !payload || typeof payload !== "object" ||
            !("employeeId" in payload) || payload.employeeId !== employee._id) continue;
        await ctx.db.patch(operation._id, {
          status: "failed", attemptCount: 5, nextRetryAt: Number.MAX_SAFE_INTEGER,
          completedAt: Date.now(), lastError: "Yüz rızası geri çekildi; gönderim iptal edildi.",
        });
      }
    }
    const payload = { employeeId: employee._id, employeeNo: employee.cardNumber, cardNumber: employee.cardNumber };
    if (device.hikTransport === "localBridge") {
      await enqueueLocalBridgeOperationInTransaction(ctx, {
        deviceId: device._id, projectId: employee.projectId, operation: "deleteFace", payload, forceNew: true,
      });
    } else {
      // The existing gateway retry worker consumes `failed`, not `pending`.
      // Zero attempts means queued for its first delivery; no success is claimed.
      await ctx.db.insert("hikPendingOperations", {
        deviceId: device._id, projectId: employee.projectId, operation: "deleteFace", payload,
        status: "failed", attemptCount: 0, nextRetryAt: Date.now(), createdAt: Date.now(),
        lastError: "Yüz şablonunun cihazdan silinmesi bekleniyor.",
      });
    }
    queued++;
  }
  return { deletedFaces: faces.length, deletedFiles, retainedPhotoFiles, queued };
}
