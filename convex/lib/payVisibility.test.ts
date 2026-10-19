import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { canSeePay, maskPay } from "./payVisibility";

describe("pay visibility", () => {
  it.each([
    ["project_user", false], ["project_admin", true], ["super_admin", true],
  ] as const)("%s: manager policy and all pay values", (role, visible) => {
    const user: Doc<"users"> = { _id: "user" as Id<"users">, _creationTime: 0, role };
    expect(canSeePay(user)).toBe(visible);
    for (const value of [undefined, null, 0, 150, 45000]) {
      expect(maskPay(value, canSeePay(user))).toBe(visible ? value : null);
    }
  });
  it("does not mutate the original value", () => {
    const original = Object.freeze({ hourlyRate: 100 });
    expect(maskPay(original, true)).toBe(original);
    expect(maskPay(original, false)).toBeNull();
    expect(original.hourlyRate).toBe(100);
  });
});
