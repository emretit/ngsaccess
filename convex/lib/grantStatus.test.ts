import { describe, expect, it } from "vitest";
import { bounded, grantStale } from "./grantStatus";

describe("grant read-time boundaries", () => {
  it("compares acknowledged time with every rule and template timestamp", () => {
    const applied = Date.parse("2026-10-22T09:00:00Z");
    expect(grantStale(applied, [undefined, "invalid", "2026-10-22T09:00:00Z"])).toBe(false);
    expect(grantStale(applied, ["2026-10-22T09:00:00.001Z"])).toBe(true);
    expect(grantStale(undefined, ["2026-10-22T09:00:00.001Z"])).toBe(false);
  });
  it("accepts complete bounded reads and rejects limit-plus-one instead of truncating", () => {
    expect(bounded([1, 2], 2)).toEqual([1, 2]);
    expect(() => bounded([1, 2, 3], 2)).toThrow("2");
  });
});
