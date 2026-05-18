import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { writeAudit } from "./audit";

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

  // 1) employeeFaces — DB + storage
  const faces = await ctx.db
    .query("employeeFaces")
    .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
    .collect();
  for (const f of faces) {
    await ctx.storage.delete(f.pictureStorageId);
    await ctx.db.delete(f._id);
  }

  // 2) employeeFingerprints — DB
  const fingerprints = await ctx.db
    .query("employeeFingerprints")
    .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
    .collect();
  for (const fp of fingerprints) {
    await ctx.db.delete(fp._id);
  }

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
  const readings = await ctx.db
    .query("cardReadings")
    .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
    .collect();
  for (const r of readings) {
    await ctx.db.patch(r._id, {
      employeeName: "[silindi]",
      cardNo: hashCardNo(r.cardNo),
    });
  }

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
        readingsAnonymized: readings.length,
      },
    },
    note: "KVKK cascade: biyometrik veri silindi, rıza iptal edildi, kart okumaları anonimleştirildi",
  });

  return {
    facesDeleted: faces.length,
    fingerprintsDeleted: fingerprints.length,
    consentsRevoked,
    readingsAnonymized: readings.length,
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
