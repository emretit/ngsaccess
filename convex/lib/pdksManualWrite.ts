import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { writeAudit } from "./audit";
import { validateManualPdksInput } from "./pdksManual";
import { buildShiftResolver } from "./shiftResolver";

type ManualPdksInput = { date: string; entryTime?: string; exitTime?: string; note?: string };
type ValidManualPdks = ReturnType<typeof validateManualPdksInput>;

export async function findManualPdksRecord(ctx: MutationCtx, employeeId: Id<"employees">, date: string): Promise<Doc<"pdksRecords"> | null> {
  return await ctx.db.query("pdksRecords").withIndex("by_employee_date", (q) => q.eq("employeeId", employeeId).eq("date", date)).first();
}

/** Tek kişilik elle yazım doğrulaması: atanmış gece vardiyası çıkışın girişten önce olmasına izin verir. */
export async function validateManualPdksForEmployee(ctx: MutationCtx, employee: Doc<"employees">, input: ManualPdksInput): Promise<ValidManualPdks> {
  const resolver = await buildShiftResolver(ctx, [employee]);
  const shift = resolver.resolve(employee._id, input.date);
  return validateManualPdksInput(input, shift?.projectId === employee.projectId ? shift : null);
}

/**
 * Elle PDKS yazımının tek yolu (upsertManual, bulkUpsertManual, düzeltme talebi onayı): kayıt varsa
 * saatleri/notu verilen değerle değiştirir (boş saat alanı silinir), yoksa ekler. `audit` ise kayıt
 * başına denetim satırı yazar; toplu yazım kendi özet satırını yazar.
 */
export async function writeManualPdksRecord(
  ctx: MutationCtx,
  args: { user: Doc<"users">; employee: Doc<"employees">; date: string; existing: Doc<"pdksRecords"> | null; input: ValidManualPdks; audit: boolean },
): Promise<{ id: Id<"pdksRecords">; created: boolean }> {
  const { user, employee, date, existing, input } = args;
  const now = new Date().toISOString();
  const status = "present" as const;
  const values = { entryTime: input.entryTime, exitTime: input.exitTime, status, manualEntry: true, manualNote: input.note, editedBy: user._id, editedAt: Date.now(), updatedAt: now };
  const newValue = { date, entryTime: input.entryTime, exitTime: input.exitTime, status, manualNote: input.note };
  if (existing) {
    await ctx.db.patch(existing._id, values);
    if (args.audit) {
      await writeAudit(ctx, {
        user, projectId: employee.projectId ?? null, action: "update", targetTable: "pdksRecords", targetId: existing._id,
        oldValue: { entryTime: existing.entryTime, exitTime: existing.exitTime, status: existing.status, manualNote: existing.manualNote },
        newValue, note: input.note,
      });
    }
    return { id: existing._id, created: false };
  }
  const id = await ctx.db.insert("pdksRecords", {
    projectId: employee.projectId, employeeId: employee._id, employeeFirstName: employee.firstName, employeeLastName: employee.lastName,
    date, ...values, createdAt: now,
  });
  if (args.audit) {
    await writeAudit(ctx, { user, projectId: employee.projectId ?? null, action: "create", targetTable: "pdksRecords", targetId: id, newValue, note: input.note });
  }
  return { id, created: true };
}
