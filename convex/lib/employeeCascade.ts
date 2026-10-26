import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { scheduleFingerprintPurge } from "./employeeCardChange";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { writeAudit } from "./audit";

const CASCADE_BATCH_SIZE = 200;

/** Both employees and visitors store their profile photo on employees. */
export async function deleteUnusedEmployeePhoto(ctx: MutationCtx, storageId: Id<"_storage">, excludeEmployeeId?: Id<"employees">) {
  const linked = await ctx.db.query("employees")
    .withIndex("by_photo_storage", q => q.eq("photoStorageId", storageId)).take(2);
  if (!linked.some(employee => employee._id !== excludeEmployeeId)) await ctx.storage.delete(storageId);
}

async function anonymizeReadingsPage(ctx: MutationCtx, employeeId: Id<"employees">, cursor: string | null) {
  const readings = await ctx.db.query("cardReadings")
    .withIndex("by_employee", q => q.eq("employeeId", employeeId))
    .paginate({ numItems: CASCADE_BATCH_SIZE, cursor });
  for (const reading of readings.page) {
    await ctx.db.patch(reading._id, { employeeName: "[silindi]", cardNo: hashCardNo(reading.cardNo) });
  }
  if (!readings.isDone) await ctx.scheduler.runAfter(0, internal.lib.employeeCascade.anonymizeReadings, {
    employeeId, cursor: readings.continueCursor,
  });
  return readings;
}

export const anonymizeReadings = internalMutation({
  args: { employeeId: v.id("employees"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await anonymizeReadingsPage(ctx, args.employeeId, args.cursor);
    return null;
  },
});

async function deleteCheckInTokensPage(ctx: MutationCtx, employeeId: Id<"employees">) {
  const tokens = await ctx.db.query("checkInTokens")
    .withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(CASCADE_BATCH_SIZE);
  for (const token of tokens) await ctx.db.delete(token._id);
  if (tokens.length === CASCADE_BATCH_SIZE) await ctx.scheduler.runAfter(0, internal.lib.employeeCascade.deleteCheckInTokens, { employeeId });
}

export const deleteCheckInTokens = internalMutation({
  args: { employeeId: v.id("employees") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deleteCheckInTokensPage(ctx, args.employeeId);
    return null;
  },
});

/**
 * KVKK 6698 / GDPR — çalışan silinince:
 *  - Biyometrik şablon (face/fingerprint) tablolarından + storage'tan kayıt sil
 *  - employeeConsents revokedAt set et (history korunur, audit izi)
 *  - cardReadings'deki PII alanları anonimleştir (employeeName, cardNo)
 *  - Cascade audit event yaz
 *
 * Çağıran `remove` mutation'unun zaten yaptığı işlemler (groupMembers,
 * employeeAuth, employeeSessions, shiftAssignments) burada tekrar yapılmaz.
 */
export async function cascadeRemoveEmployeePII(
  ctx: MutationCtx & { user: Doc<"users"> },
  employeeId: Id<"employees">,
): Promise<{
  facesDeleted: number;
  fingerprintsDeleted: number;
  consentsRevoked: number;
  readingsAnonymized: number;
}> {
  const employee = await ctx.db.get(employeeId);

  // Her iki okuma da sınırlıdır; taşmada silme işleminin tamamı geri alınır.
  const requestLimit = 1000;
  const corrections = await ctx.db.query("attendanceCorrections")
    .withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(requestLimit + 1);
  const leaves = await ctx.db.query("leaves")
    .withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(requestLimit + 1);
  if (corrections.length > requestLimit || leaves.length > requestLimit) {
    throw new ConvexError({ code: "EMPLOYEE_REQUEST_CASCADE_LIMIT", message: "Kişinin talep geçmişi silme sınırını aşıyor. Talepleri arşivlemek için yöneticinizle iletişime geçin." });
  }
  const decidedAt = new Date().toISOString();
  for (const correction of corrections) {
    if (correction.status === "pending") await ctx.db.patch(correction._id, {
      status: "withdrawn", decisionNote: "Kişi kaydı silindi", decidedAt,
      decidedBy: undefined, updatedAt: decidedAt,
    });
  }
  for (const leave of leaves) {
    if (leave.source === "employee" && leave.status === "pending") await ctx.db.delete(leave._id);
  }

  // 1) employeeFaces — DB + storage
  const faces = await ctx.db
    .query("employeeFaces")
    .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
    .collect();
  for (const f of faces) {
    await deleteUnusedEmployeePhoto(ctx, f.pictureStorageId, employeeId);
    await ctx.db.delete(f._id);
  }

  if (employee?.photoStorageId && !faces.some(face => face.pictureStorageId === employee.photoStorageId)) {
    await deleteUnusedEmployeePhoto(ctx, employee.photoStorageId, employeeId);
  }

  // 2) employeeFingerprints — DB
  const fingerprints = await ctx.db
    .query("employeeFingerprints")
    .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
    .collect();
  await scheduleFingerprintPurge(ctx, employeeId, employee?.cardNumber ?? "", { deleteTemplates: true });

  // 3) employeeConsents — revoke (silmiyoruz; history korunur)
  const consents = await ctx.db
    .query("employeeConsents")
    .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
    .collect();
  const now = new Date().toISOString();
  let consentsRevoked = 0;
  for (const c of consents) {
    if (!c.revokedAt) {
      await ctx.db.patch(c._id, { revokedAt: now });
      consentsRevoked += 1;
    }
  }

  // 4) cardReadings — PII anonimleştir
  const readings = await anonymizeReadingsPage(ctx, employeeId, null);
  await deleteCheckInTokensPage(ctx, employeeId);

  // 5) Audit
  await writeAudit(ctx, {
    user: ctx.user,
    projectId: employee?.projectId ?? null,
    action: "delete",
    targetTable: "employees",
    targetId: employeeId,
    newValue: {
      cascade: {
        faces: faces.length,
        fingerprints: fingerprints.length,
        consentsRevoked,
        readingsAnonymized: readings.page.length,
        readingsAnonymizationPending: !readings.isDone,
      },
    },
    note: "KVKK cascade: biyometrik veri silindi, rıza iptal edildi, kart okumalarının anonimleştirilmesi başlatıldı",
  });

  return {
    facesDeleted: faces.length,
    fingerprintsDeleted: fingerprints.length,
    consentsRevoked,
    readingsAnonymized: readings.page.length,
  };
}

/** Kart numarasını geri döndürülemez şekilde maskele. Basit hash; gerçek bir cryptographic hash gerekmiyor — PII reidentification engellenmesi yeterli. */
function hashCardNo(cardNo: string): string {
  let h = 0;
  for (let i = 0; i < cardNo.length; i++) {
    h = (Math.imul(31, h) + cardNo.charCodeAt(i)) | 0;
  }
  return `anon-${(h >>> 0).toString(16).padStart(8, "0")}`;
}
