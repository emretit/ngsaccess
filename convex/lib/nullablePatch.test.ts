import { describe, expect, it } from "vitest";
import { toPatch } from "./nullablePatch";

describe("toPatch", () => {
  it("undefined alanı patch'e hiç eklemez", () => {
    expect(Object.prototype.hasOwnProperty.call(toPatch({ name: undefined }), "name")).toBe(false);
  });
  it("null alanını silmek için own undefined property üretir", () => {
    const patch = toPatch({ name: null });
    expect(Object.prototype.hasOwnProperty.call(patch, "name")).toBe(true);
    expect(patch.name).toBeUndefined();
  });
  it("boş metin, sıfır ve false değerlerini korur; girdiyi değiştirmez", () => {
    const args = { name: "", count: 0, active: false, note: null, untouched: undefined };
    expect(toPatch(args)).toEqual({ name: "", count: 0, active: false, note: undefined });
    expect(args.note).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(args, "untouched")).toBe(true);
  });
  it("yalnız düz alanları dönüştürür", () => {
    const nested = { value: null };
    expect(toPatch({ nested }).nested).toBe(nested);
    expect(toPatch({})).toEqual({});
  });
});
