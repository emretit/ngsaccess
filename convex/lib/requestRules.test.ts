import { ConvexError } from "convex/values";
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

describe('typed validation errors', () => {
  it.each([
    ['REQUEST_DATE_INVALID', () => validateLeaveRequestRange('2026-02-30', '2026-03-01', '2026-10-19')],
    ['REQUEST_RANGE_INVALID', () => validateLeaveRequestRange('2026-10-20', '2026-10-19', '2026-10-19')],
    ['REQUEST_START_TOO_OLD', () => validateLeaveRequestRange('2026-09-18', '2026-09-20', '2026-10-19')],
    ['REQUEST_RANGE_TOO_LONG', () => validateLeaveRequestRange('2026-10-01', '2026-11-30', '2026-10-19')],
    ['CORRECTION_DATE_OUT_OF_RANGE', () => validateCorrectionDate('2026-10-20', '2026-10-19')],
  ] as const)('%s exposes ConvexError.data.code', (code, action) => {
    try { action(); throw new Error('expected rejection'); }
    catch (error) { expect(error).toBeInstanceOf(ConvexError); if (error instanceof ConvexError) expect(error.data.code).toBe(code); }
  });
});
