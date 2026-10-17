import { describe, expect, it } from "vitest";
import { routeMeta, safeReturnPath } from "../../lib/routeMeta";

describe("güvenli giriş dönüşü", () => {
  it("sorgu ve hash'i korur", () => expect(safeReturnPath("/employees?status=active#person-42")).toBe("/employees?status=active#person-42"));
  it.each([null, "https://evil.test", "//evil.test", "/\\evil.test", "/%2Fevil.test", "/%5cevil.test", "/login?next=/login", "/auth", "/%6cogin", "/foo/../login", "/%zz", "/\nevil.test"])("güvensiz veya döngülü hedefi reddeder: %s", (target) => expect(safeReturnPath(target)).toBe("/home"));
  it("her rota tek ve eksik başlıklar tanımlı", () => {
    expect(new Set(routeMeta.map(item => item.href)).size).toBe(routeMeta.length);
    for (const href of ["/home", "/audit-log", "/engineering-department", "/virtual-readers"]) expect(routeMeta.find(item => item.href === href)?.name).toBeTruthy();
  });
});
