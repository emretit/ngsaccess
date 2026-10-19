import { describe, expect, it } from "vitest";
import { overlaps, validateCorrectionDate, validateLeaveRequestRange } from "./requestRules";

describe("request rules", () => {
  it("detects inclusive overlap", () => { expect(overlaps("2026-10-01", "2026-10-03", "2026-10-03", "2026-10-05")).toBe(true); });
  it("accepts a 60 day leave and rejects 61 days", () => {
    expect(() => validateLeaveRequestRange("2026-10-01", "2026-11-29", "2026-10-19")).not.toThrow();
    expect(() => validateLeaveRequestRange("2026-10-01", "2026-11-30", "2026-10-19")).toThrow();
  });
  it("enforces leave and correction windows", () => {
    expect(() => validateLeaveRequestRange("2026-09-19", "2026-09-20", "2026-10-19")).not.toThrow();
    expect(() => validateLeaveRequestRange("2026-09-18", "2026-09-20", "2026-10-19")).toThrow();
    expect(() => validateCorrectionDate("2026-10-20", "2026-10-19")).toThrow();
    expect(() => validateCorrectionDate("2026-09-19", "2026-10-19")).not.toThrow();
  });
});
