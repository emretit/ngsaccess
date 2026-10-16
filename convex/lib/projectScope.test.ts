import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import { selectProjectScope } from "./projectScope";

const a = "project-a" as Id<"projects">;
const b = "project-b" as Id<"projects">;

describe("selectProjectScope", () => {
  it("seçim yoksa tüm izinli projeleri döndürür", () => {
    const allowed = [a, b];
    expect(selectProjectScope(allowed)).toEqual([a, b]);
    expect(selectProjectScope(allowed)).not.toBe(allowed);
  });
  it("seçimi tek yetkili projeye daraltır", () => {
    expect(selectProjectScope([a, b], b)).toEqual([b]);
  });
  it("yetkisiz seçimi Türkçe hata ile reddeder", () => {
    expect(() => selectProjectScope([a], b)).toThrow("Bu projeye erişim yetkiniz yok");
    expect(() => selectProjectScope([], a)).toThrow("Bu projeye erişim yetkiniz yok");
  });
  it("projesiz kullanıcıda boş kapsam döndürür", () => {
    expect(selectProjectScope([])).toEqual([]);
  });
});
