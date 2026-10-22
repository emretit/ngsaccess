import { describe, expect, it } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { employeeWithinAccessEpoch } from "./mobileAccess";

function employee(fields: Partial<Doc<"employees">>): Doc<"employees"> {
  return { firstName: "Ada", lastName: "Test", isActive: true, ...fields } as Doc<"employees">;
}
const at = (iso: string) => Date.parse(iso);

describe("employeeWithinAccessEpoch employment end (QR/mobil/check-in)", () => {
  it("allows through the last Turkey day and denies from the next Turkey midnight", () => {
    const ended = employee({ employmentEndDate: "2026-10-19" });
    expect(employeeWithinAccessEpoch(ended, at("2026-10-19T09:00:00.000Z"))).toBe(true);
    expect(employeeWithinAccessEpoch(ended, at("2026-10-19T20:59:59.999Z"))).toBe(true);
    expect(employeeWithinAccessEpoch(ended, at("2026-10-19T21:00:00.000Z"))).toBe(false);
    expect(employeeWithinAccessEpoch(ended, at("2026-10-21T09:00:00.000Z"))).toBe(false);
  });
  it("denies an active employee whose end date has passed even without accessExpiresAt", () => {
    expect(employeeWithinAccessEpoch(employee({ employmentEndDate: "2026-10-18" }), at("2026-10-19T09:00:00.000Z"))).toBe(false);
  });
  it("keeps future end dates, missing end dates and visitors governed by the access window only", () => {
    const now = at("2026-10-19T09:00:00.000Z");
    expect(employeeWithinAccessEpoch(employee({ employmentEndDate: "2026-12-31" }), now)).toBe(true);
    expect(employeeWithinAccessEpoch(employee({}), now)).toBe(true);
    expect(employeeWithinAccessEpoch(employee({ isVisitor: true, employmentEndDate: "2026-10-01" }), now)).toBe(true);
    expect(employeeWithinAccessEpoch(employee({ isVisitor: true, accessExpiresAt: "2026-10-19T08:00:00.000Z" }), now)).toBe(false);
  });
  it("still fails closed on inactive employees and invalid time", () => {
    expect(employeeWithinAccessEpoch(employee({ isActive: false }), at("2026-10-19T09:00:00.000Z"))).toBe(false);
    expect(employeeWithinAccessEpoch(employee({ employmentEndDate: "2026-12-31" }), Number.NaN)).toBe(false);
    expect(employeeWithinAccessEpoch(employee({}), Number.NaN)).toBe(false);
  });
});
