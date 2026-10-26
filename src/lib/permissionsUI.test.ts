import { describe, expect, it } from "vitest";
import { permissionCapabilities } from "./capabilities";
import { readingRouteAccess, visibleRoutes } from "./routeMeta";
import { PROJECT_ROLES, ROLE_DEFAULTS, type Permission } from "../../convex/lib/roleCatalog";

describe("proje yetkilerinden arayüz görünürlüğü", () => {
  it.each(PROJECT_ROLES)("maps default settings tabs for %s", role => {
    const can = (permission: Permission) => ROLE_DEFAULTS[role].includes(permission);
    const tabs = permissionCapabilities(can, role).settingsTabs;
    expect(tabs.includes("roles")).toBe(role === "admin");
    expect(tabs.includes("users")).toBe(role === "admin");
    expect(tabs.includes("integrations")).toBe(role === "admin" || role === "technician");
    expect(tabs.includes("reports")).toBe(role !== "technician");
    expect(tabs.includes("mail")).toBe(role === "admin");
  });
  it("uses current permissions for menus even if the account has legacy admin metadata", () => {
    const routes = visibleRoutes("project_admin", false, permission => permission === "devices.manage");
    const hrefs = routes.map(route => route.href);
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/alarms");
    for (const href of ["/employees", "/reports", "/audit-log", "/system-admin"]) expect(hrefs).not.toContain(href);
    expect(permissionCapabilities(() => false, "admin").settingsTabs).toEqual([]);
  });
  it("shows the platform menu only to super admins", () => {
    expect(permissionCapabilities(() => true, "super_admin").settingsTabs).toContain("mail");
    expect(visibleRoutes("admin", false, () => true).map(route => route.href)).not.toContain("/system-admin");
    expect(visibleRoutes("super_admin", false, () => true).map(route => route.href)).toContain("/system-admin");
  });
});

it.each([
  { permissions: ["devices.manage"], pdks: false, live: true },
  { permissions: ["reports.view"], pdks: true, live: true },
  { permissions: [], pdks: false, live: false },
])("reading menus follow current grants: $permissions", ({ permissions, pdks, live }) => {
  const hrefs = visibleRoutes("technician", false, permission => permissions.includes(permission)).map(route => route.href);
  expect(hrefs.includes("/pdks-records")).toBe(pdks);
  expect(hrefs.includes("/live-monitoring")).toBe(live);
});

describe("okuma sayfalarına doğrudan erişim", () => {
  const only = (...granted: Permission[]) => (permission: Permission) => granted.includes(permission);
  it("PDKS reports.view ister; ayarlar alt sayfası kendi yetkisine bırakılır", () => {
    expect(readingRouteAccess("/pdks-records", "", only("reports.view"))).toBe(true);
    expect(readingRouteAccess("/pdks-records", "", only("schedule.manage"))).toBe(false);
    expect(readingRouteAccess("/pdks-records/settings", "", only("schedule.manage"))).toBeNull();
  });
  it("vardiya planı schedule.manage ile de açılır", () => {
    expect(readingRouteAccess("/pdks-records", "?plan=1", only("schedule.manage"))).toBe(true);
    expect(readingRouteAccess("/pdks-records", "?plan=1", only("employees.view"))).toBe(false);
  });
  it("canlı izleme reports.view veya devices.manage ister", () => {
    expect(readingRouteAccess("/live-monitoring", "", only("devices.manage"))).toBe(true);
    expect(readingRouteAccess("/live-monitoring/x", "", only("employees.view"))).toBe(false);
    expect(readingRouteAccess("/home", "", only())).toBeNull();
  });
});
