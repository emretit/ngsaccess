import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { employeeFormValues, type EmployeeFormData } from "./useEmployeeFormData";
import { onlyChangedFields } from "./useEmployeeFormSubmit";

const employeeId = "employee-a" as Id<"employees">;
const base: EmployeeFormData = {
  ...employeeFormValues(null),
  firstName: "Ada",
  lastName: "Test",
  email: "ada@example.test",
  cardNumber: "0008",
  isActive: false,
  monthlySalary: 1000,
  photoUrl: "https://example.test/a.jpg",
  photoStorageId: "storage-a" as Id<"_storage">,
};
const full = (data: EmployeeFormData) => ({
  employeeId,
  firstName: data.firstName,
  lastName: data.lastName,
  email: data.email,
  cardNumber: data.cardNumber,
  isActive: data.isActive,
  monthlySalary: data.monthlySalary,
  notes: data.notes || null,
  photoUrl: data.photoUrl,
  photoStorageId: data.photoStorageId,
});

describe("onlyChangedFields", () => {
  it("sends only fields the user changed, so a stale isActive cannot overwrite a reinstatement", () => {
    const edited = { ...base, firstName: "Ayşe" };
    expect(onlyChangedFields(full(edited), edited, JSON.stringify(base))).toEqual({ employeeId, firstName: "Ayşe" });
  });

  it("keeps a deliberate isActive change and clearing a salary", () => {
    const edited = { ...base, isActive: true, monthlySalary: null };
    expect(onlyChangedFields(full(edited), edited, JSON.stringify(base))).toEqual({ employeeId, isActive: true, monthlySalary: null });
  });

  it("sends the photo URL and storage id together when the photo changes", () => {
    const edited = { ...base, photoUrl: "https://example.test/b.jpg", photoStorageId: "storage-b" as Id<"_storage"> };
    expect(onlyChangedFields(full(edited), edited, JSON.stringify(base))).toEqual({ employeeId, photoUrl: "https://example.test/b.jpg", photoStorageId: "storage-b" });
  });

  it("always keeps an added access rule and falls back to the full payload without a baseline", () => {
    const rule = "rule-a" as Id<"accessRules">;
    expect(onlyChangedFields({ employeeId, accessRuleId: rule, firstName: "Ada" }, { ...base, accessRuleId: rule }, JSON.stringify(base))).toEqual({ employeeId, accessRuleId: rule });
    expect(onlyChangedFields(full(base), base, undefined)).toEqual(full(base));
  });
});
