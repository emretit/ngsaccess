import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { writeManualPdksRecord } from "./pdksManualWrite";

const user = { _id: "u1" as Id<"users">, name: "Yönetici" } as Doc<"users">;
const employee = { _id: "e1" as Id<"employees">, projectId: "p1" as Id<"projects">, firstName: "Ada", lastName: "Yılmaz" } as Doc<"employees">;
const input = { entryTime: "08:10", exitTime: "17:05", note: "Kart unutuldu" };

function createCtx() {
  const insert = vi.fn(async (table: string) => (table === "pdksRecords" ? "r-new" : "audit-1"));
  const patch = vi.fn(async () => undefined);
  return { ctx: { db: { insert, patch } } as unknown as MutationCtx, insert, patch };
}

describe("writeManualPdksRecord", () => {
  it("mevcut kaydı elle işaretleyip günceller ve eski/yeni değerle denetim yazar", async () => {
    const { ctx, insert, patch } = createCtx();
    const existing = { _id: "r1" as Id<"pdksRecords">, entryTime: "09:00", exitTime: undefined, status: "absent", manualNote: undefined } as unknown as Doc<"pdksRecords">;
    const result = await writeManualPdksRecord(ctx, { user, employee, date: "2026-10-20", existing, input, audit: true });

    expect(result).toEqual({ id: "r1", created: false });
    expect(patch).toHaveBeenCalledWith("r1", expect.objectContaining({ entryTime: "08:10", exitTime: "17:05", status: "present", manualEntry: true, manualNote: "Kart unutuldu", editedBy: "u1" }));
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ action: "update", targetTable: "pdksRecords", targetId: "r1" }));
  });

  it("kayıt yoksa ekler; toplu yazımda kayıt başına denetim yazmaz", async () => {
    const { ctx, insert, patch } = createCtx();
    const result = await writeManualPdksRecord(ctx, { user, employee, date: "2026-10-20", existing: null, input, audit: false });

    expect(result).toEqual({ id: "r-new", created: true });
    expect(patch).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith("pdksRecords", expect.objectContaining({ projectId: "p1", employeeId: "e1", employeeFirstName: "Ada", date: "2026-10-20", status: "present", manualEntry: true }));
  });
});
