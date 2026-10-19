import { describe, expect, it } from "vitest";
import { capabilities } from "./capabilities";
describe("sayfa ve işlem yetenekleri", () => {
  it.each([undefined, "project_user", "unknown"])("%s yetkisiz yönetim sorgularını açmaz", role => {
    const result = capabilities(role);
    expect(result.settingsTabs).toEqual([]);
    expect(result.admin).toBe(false);
    expect(result.manageUsers).toBe(false);
    expect(result.auditLog).toBe(false);
  });
  it("proje yöneticisi davet eder, rol ve üyelik değiştiremez", () => {
    const result = capabilities("project_admin");
    expect(result.inviteUsers).toBe(true);
    expect(result.manageUsers).toBe(false);
    expect(result.systemAdmin).toBe(false);
    expect(result.auditLog).toBe(true);
    expect(result.settingsTabs).toEqual(["general", "users", "work-payroll", "reports", "integrations", "privacy", "notifications"]);
  });
  it("süper admin tüm sekme ve işlemlere erişir", () => {
    const result = capabilities("super_admin");
    expect(result.settingsTabs).toHaveLength(8);
    expect(result.settingsTabs).toContain("mail");
    expect(result.manageUsers).toBe(true);
    expect(result.systemAdmin).toBe(true);
  });
});
