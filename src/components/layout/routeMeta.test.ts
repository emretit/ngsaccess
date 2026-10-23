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
