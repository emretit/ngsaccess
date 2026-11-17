import { describe, expect, it } from "vitest";
import { routeMeta, safeReturnPath, visibleRoutes } from "../../lib/routeMeta";

describe("güvenli giriş dönüşü", () => {
  it("sorgu ve hash'i korur", () => expect(safeReturnPath("/employees?status=active#person-42")).toBe("/employees?status=active#person-42"));
  it.each([null, "https://evil.test", "//evil.test", "/\\evil.test", "/%2Fevil.test", "/%5cevil.test", "/login?next=/login", "/auth", "/%6cogin", "/foo/../login", "/%zz", "/\nevil.test"])("güvensiz veya döngülü hedefi reddeder: %s", (target) => expect(safeReturnPath(target)).toBe("/home"));
  it("her rota tek ve eksik başlıklar tanımlı", () => {
    expect(new Set(routeMeta.map(item => item.href)).size).toBe(routeMeta.length);
    for (const href of ["/home", "/audit-log", "/engineering-department"]) expect(routeMeta.find(item => item.href === href)?.name).toBeTruthy();
  });
});

describe("Sanal okuyucular menüsü", () => {
  it("ayrı menü öğesi yok; Cihazlar → Cihaz ekle içinde", () => {
    expect(visibleRoutes("admin").find(route => route.href === "/virtual-readers")).toBeUndefined();
    expect(visibleRoutes("admin").some(route => route.href === "/devices")).toBe(true);
  });
});

it("PDKS contains the plan and shift definitions without a separate shifts menu", () => {
  expect(routeMeta.find(route => route.href === "/pdks-records")?.name).toBe("PDKS");
  expect(routeMeta.some(route => route.href === "/shifts")).toBe(false);
});

it("resolves PDKS nested titles without adding menu or permission entries", async () => {
  const { resolveRouteContext } = await import("@/lib/routeMeta");
  expect(resolveRouteContext("/pdks-records/plan")).toEqual({ title: "Vardiya planı", breadcrumbs: [
    { name: "Ana Sayfa", href: "/home" }, { name: "PDKS", href: "/pdks-records" }, { name: "Vardiya planı" },
  ] });
  expect(resolveRouteContext("/pdks-records/settings").title).toBe("PDKS Ayarları");
  expect(routeMeta.some(route => route.href === "/pdks-records/plan")).toBe(false);
});

it("resolves report groups and details from the actual report registry", async () => {
  const { resolveRouteContext } = await import("@/lib/routeMeta");
  const { REPORT_GROUPS, reportGroupPath } = await import("@/lib/reports/groups");
  const { reportsInGroup } = await import("@/lib/reports/registry");
  for (const group of REPORT_GROUPS) {
    const context = resolveRouteContext(reportGroupPath(group.key));
    expect(context.title).toBe(group.key === "resmi" ? "Muhasebe Raporları" : `${group.label} Raporları`);
    for (const report of reportsInGroup(group.key)) {
      const detail = resolveRouteContext(reportGroupPath(group.key, report.slug));
      expect(detail.title).toBe(report.title);
      expect(detail.breadcrumbs.slice(-2)).toEqual([{ name: group.label, href: reportGroupPath(group.key) }, { name: report.title }]);
    }
  }
  expect(resolveRouteContext("/reports/no-group/no-report").title).toBe("Rapor bulunamadı");
  expect(resolveRouteContext("/reports/gunluk/no-report").title).toBe("Rapor bulunamadı");
});
