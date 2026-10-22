import { describe, expect, it } from "vitest";
import { maskPay } from "./payVisibility";

describe("pay visibility", () => {
  it.each([true, false])("masks all pay values with permission %s", visible => {
    for (const value of [undefined, null, 0, 150, 45000]) {
      expect(maskPay(value, visible)).toBe(visible ? value : null);
    }
  });
  it("does not mutate the original value", () => {
    const original = Object.freeze({ hourlyRate: 100 });
    expect(maskPay(original, true)).toBe(original);
    expect(maskPay(original, false)).toBeNull();
    expect(original.hourlyRate).toBe(100);
  });
});
