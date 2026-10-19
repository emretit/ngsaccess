import { describe, expect, it } from "vitest";
import { displayVisitorStatus, isVisitorStatus, visitorStatusInfo } from "./status";

describe("visitor status UI contract", () => {
  it("only accepts the backend enum, including closed and expired separately", () => {
    for (const status of ["active", "checkedOut", "expired", "preRegistered"]) expect(isVisitorStatus(status)).toBe(true);
    for (const status of [null, "inactive", "inside", "ended", "constructor", "__proto__"]) expect(isVisitorStatus(status)).toBe(false);
    expect(visitorStatusInfo.checkedOut).toEqual({ label: "Sonlandırıldı / pasif", tone: "neutral" });
    expect(visitorStatusInfo.expired).toEqual({ label: "Süresi doldu", tone: "warning" });
  });
});

it("derives expiration from visitEnd and preserves manual termination", () => {
  const now = Date.parse("2030-01-01T00:00:00Z");
  expect(displayVisitorStatus({ status: "active", visitEnd: "2029-01-01T00:00:00Z" }, now)).toBe("expired");
  expect(displayVisitorStatus({ status: "checkedOut", visitEnd: "2029-01-01T00:00:00Z" }, now)).toBe("checkedOut");
});
