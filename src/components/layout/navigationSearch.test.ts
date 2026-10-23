import { describe, expect, it } from "vitest";
import { filterNavigationRoutes, normalizeNavigationSearch } from "./navigationSearch";
import { visibleRoutes } from "@/lib/routeMeta";

describe("navigation visibility and Turkish search", () => {
  it.each([["super_admin", 14], ["project_admin", 13], ["project_user", 12]])("%s has %i menu routes", (role, count) => {
    expect(visibleRoutes(String(role))).toHaveLength(Number(count));
  });
  it("includes profile but not hidden engineering or unauthorized routes", () => {
    const hrefs = filterNavigationRoutes("project_user", "").map(route => route.href);
    expect(hrefs).toContain("/profile");
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/alarms");
    for (const href of ["/system-admin", "/audit-log", "/engineering-department"]) expect(hrefs).not.toContain(href);
  });
  it.each(["İZİNLER", "izinler", "ızınler", "IZINLER"])("folds Turkish letters: %s", query => {
    expect(filterNavigationRoutes("project_user", query).map(route => route.href)).toEqual(["/leaves"]);
  });
  it("matches whitespace-separated words and ASCII keyboards", () => {
    expect(filterNavigationRoutes("project_user", "  CANLI   IZLEME ")[0]?.href).toBe("/live-monitoring");
    expect(normalizeNavigationSearch("KİŞİLER")).toBe("kisiler");
  });
  it("has an empty result, including forbidden exact names", () => {
    expect(filterNavigationRoutes("project_user", "Admin")).toEqual([]);
    expect(filterNavigationRoutes("super_admin", "bulunmayan")).toEqual([]);
  });
  it("keeps the specified group order", () => {
    expect(visibleRoutes("super_admin").map(route => route.group)).toEqual([...Array(6).fill("main"), ...Array(4).fill("attendance"), ...Array(4).fill("management")]);
  });
});
