import { describe, expect, it } from "vitest";
import { shouldPurgeVisitor, validVisitorRetentionDays, VISITOR_RETENTION_DAY_MS } from "./visitorRetention";
const now = Date.parse("2026-10-27T12:00:00Z");
const before = (days: number) => new Date(now - days * VISITOR_RETENTION_DAY_MS).toISOString();
const visitor = { isVisitor: true, isActive: false, accessExpiresAt: before(100) };
describe("visitor retention eligibility", () => {
  it.each([null, 30, 90, 3650])("accepts %s days", days => expect(validVisitorRetentionDays(days)).toBe(true));
  it.each([0, 29, 3651, 30.5, NaN, Infinity])("rejects %s days", days => expect(validVisitorRetentionDays(days)).toBe(false));
  it("defaults to disabled and uses the expiry before the update time", () => {
    expect(shouldPurgeVisitor(visitor, null, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, updatedAt: before(1) }, 90, now)).toBe(true);
    expect(shouldPurgeVisitor({ ...visitor, accessExpiresAt: before(80) }, 90, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, accessExpiresAt: before(90) }, 90, now)).toBe(false);
  });
  it("falls back to updatedAt only when expiry is absent", () => {
    expect(shouldPurgeVisitor({ ...visitor, accessExpiresAt: undefined, updatedAt: before(100) }, 90, now)).toBe(true);
    expect(shouldPurgeVisitor({ ...visitor, accessExpiresAt: undefined }, 90, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, accessExpiresAt: "invalid", updatedAt: before(100) }, 90, now)).toBe(false);
  });
  it("preserves active people, employees and recent or future expiry", () => {
    expect(shouldPurgeVisitor({ ...visitor, isActive: true }, 90, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, isActive: undefined }, 90, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, isVisitor: false }, 90, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, visitorStatus: "preRegistered" }, 90, now)).toBe(true);
    expect(shouldPurgeVisitor({ ...visitor, visitorStatus: "preRegistered", accessExpiresAt: before(10) }, 90, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, visitorStatus: "preRegistered", accessExpiresAt: before(90) }, 90, now)).toBe(false);
    expect(shouldPurgeVisitor({ ...visitor, accessExpiresAt: before(-1) }, 90, now)).toBe(false);
  });
});
