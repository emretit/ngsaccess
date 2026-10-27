import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { applyShiftRules, createVersionedShiftLookup, ruleSnapshot } from "./shiftVersions";
import { createShiftResolver } from "./shiftResolver";
import { manualValidationShift } from "./pdksManualWrite";

const shiftId = "shift" as Id<"shifts">;
const current: Doc<"shifts"> = { _id: shiftId, _creationTime: 0, name: "Gündüz", startTime: "10:00", endTime: "18:00", minWorkMinutes: 300, versionedUntil: "2026-06-23", createdAt: "", updatedAt: "" };
const older = { shiftId, validUntil: "2026-06-10", rules: { startTime: "08:00", endTime: "16:00" } };
const old = { shiftId, validUntil: "2026-06-23", rules: { startTime: "09:00", endTime: "17:00", lateToleranceMinutes: 5 } };

describe("shift versions", () => {
  it("anlık görüntü yalnız hesap alanlarını alır; uygulanınca güncel kural alanları silinir, ad korunur", () => {
    expect(ruleSnapshot(current)).toEqual({ startTime: "10:00", endTime: "18:00", minWorkMinutes: 300 });
    const applied = applyShiftRules(current, old.rules);
    expect(applied).toMatchObject({ _id: shiftId, name: "Gündüz", startTime: "09:00", lateToleranceMinutes: 5 });
    expect(applied).not.toHaveProperty("minWorkMinutes");
  });
  it("tarihe göre sürüm seçer, sınır günü eski sürümdedir ve aynı nesne döner", () => {
    const lookup = createVersionedShiftLookup(new Map([[shiftId, current]]), [old, older]);
    expect(lookup(shiftId, "2026-06-01")?.startTime).toBe("08:00");
    expect(lookup(shiftId, "2026-06-10")?.startTime).toBe("08:00");
    expect(lookup(shiftId, "2026-06-11")?.startTime).toBe("09:00");
    expect(lookup(shiftId, "2026-06-23")?.startTime).toBe("09:00");
    expect(lookup(shiftId, "2026-06-24")).toBe(current);
    expect(lookup(shiftId, "2026-06-12")).toBe(lookup(shiftId, "2026-06-13"));
  });
  it("çözümleyici plan gününe o günün sürümünü verir", () => {
    const employee = { _id: "emp" as Id<"employees">, _creationTime: 0, firstName: "A", lastName: "B", email: "", cardNumber: "1" } as Doc<"employees">;
    const assignment = { _id: "a" as Id<"shiftAssignments">, _creationTime: 0, employeeId: employee._id, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" } as Doc<"shiftAssignments">;
    const resolver = createShiftResolver([employee], [current], [[assignment]], [], [], [old]);
    expect(resolver.resolve(employee._id, "2026-06-20")?.startTime).toBe("09:00");
    expect(resolver.resolve(employee._id, "2026-06-24")?.startTime).toBe("10:00");
    expect(resolver.shifts.get(shiftId)).toBe(current);
  });
  it("plansız eski çalışan vardiyası yedeği de o günün sürümünü kullanır", () => {
    const employee = { _id: "emp" as Id<"employees">, _creationTime: 0, firstName: "A", lastName: "B", email: "", cardNumber: "1", shiftId } as Doc<"employees">;
    const resolver = createShiftResolver([employee], [current], [[]], [], [], [old]);
    expect(manualValidationShift(resolver, employee, "2026-06-20")?.startTime).toBe("09:00");
    expect(manualValidationShift(resolver, employee, "2026-06-24")?.startTime).toBe("10:00");
  });
});
