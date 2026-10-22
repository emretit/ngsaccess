import { describe, expect, it } from "vitest";
import { employedDuring, employedOn, employmentEnded } from "./employment";

describe("employment period", () => {
  it.each([true, false])("includes the last day for active=%s and excludes later days", isActive => {
    const employee = { isActive, employmentEndDate: "2026-10-15" };
    expect(employedOn(employee, "2026-10-14")).toBe(true);
    expect(employedOn(employee, "2026-10-15")).toBe(true);
    expect(employedOn(employee, "2026-10-16")).toBe(false);
    expect(employedDuring(employee, "2026-10-01", "2026-10-31")).toBe(true);
    expect(employedDuring(employee, "2026-10-15", "2026-10-31")).toBe(true);
    expect(employedDuring(employee, "2026-10-16", "2026-10-31")).toBe(false);
  });
  it("preserves legacy active/inactive and rejects inverted periods", () => {
    expect(employedOn({ isActive: true }, "2020-01-01")).toBe(true);
    expect(employedOn({ isActive: false }, "2020-01-01")).toBe(false);
    expect(employedOn({}, "2020-01-01")).toBe(false);
    expect(employedDuring({ isActive: true }, "2026-11-01", "2026-10-01")).toBe(false);
  });
  it("a scheduled termination keeps future days only through the end date", () => {
    expect(employedOn({ isActive: true, employmentEndDate: "2099-10-15" }, "2099-10-15")).toBe(true);
    expect(employedOn({ isActive: true, employmentEndDate: "2099-10-15" }, "2099-10-16")).toBe(false);
  });
  it.each([true, false, undefined])("visitors retain active=%s irrespective of employment end date", isActive => {
    const visitor = { isVisitor: true, isActive, employmentEndDate: "2026-10-15" };
    expect(employedOn(visitor, "2026-11-01")).toBe(isActive === true);
    expect(employedDuring(visitor, "2026-10-01", "2026-10-31")).toBe(isActive === true);
  });
  it.each([true, false, undefined])("employmentEnded only after the last day, never for visitors or open-ended records (active=%s)", isActive => {
    expect(employmentEnded({ isActive, employmentEndDate: "2026-10-15" }, "2026-10-15")).toBe(false);
    expect(employmentEnded({ isActive, employmentEndDate: "2026-10-15" }, "2026-10-16")).toBe(true);
    expect(employmentEnded({ isActive }, "2026-10-16")).toBe(false);
    expect(employmentEnded({ isActive, isVisitor: true, employmentEndDate: "2026-10-15" }, "2026-10-16")).toBe(false);
  });
});
