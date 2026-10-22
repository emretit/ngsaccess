import { describe, expect, it } from "vitest";
import { permissionCapabilities } from "./capabilities";
import { visibleRoutes } from "./routeMeta";
import { PROJECT_ROLES, ROLE_DEFAULTS, type Permission } from "../../convex/lib/roleCatalog";

describe("proje yetkilerinden arayüz görünürlüğü", () => {
  it.each(PROJECT_ROLES)("maps default settings tabs for %s", role => {
    const can = (permission: Permission) => ROLE_DEFAULTS[role].includes(permission);
    const tabs = permissionCapabilities(can, role).settingsTabs;
    expect(tabs.includes("roles")).toBe(role === "admin");
    expect(tabs.includes("users")).toBe(role === "admin");
    expect(tabs.includes("work-payroll")).toBe(role === "admin" || role === "hr");
    expect(tabs.includes("integrations")).toBe(role === "admin" || role === "technician");
    expect(tabs.includes("reports")).toBe(role !== "technician");
    expect(tabs.includes("mail")).toBe(false);
  });
  it("uses current permissions for menus even if the account has legacy admin metadata", () => {
    const routes = visibleRoutes("project_admin", false, permission => permission === "devices.manage");
    const hrefs = routes.map(route => route.href);
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/alarms");
    for (const href of ["/employees", "/reports", "/audit-log", "/system-admin"]) expect(hrefs).not.toContain(href);
    expect(permissionCapabilities(() => false, "admin").settingsTabs).toEqual([]);
  });
  it("shows the platform menu and mail only to super admins", () => {
    expect(permissionCapabilities(() => true, "super_admin").settingsTabs).toContain("mail");
    expect(visibleRoutes("admin", false, () => true).map(route => route.href)).not.toContain("/system-admin");
    expect(visibleRoutes("super_admin", false, () => true).map(route => route.href)).toContain("/system-admin");
  });
});
