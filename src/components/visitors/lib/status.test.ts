import { describe, expect, it } from "vitest";
import { isVisitorStatus, visitorStatusInfo } from "./status";

describe("visitor status UI contract", () => {
  it("only accepts the backend enum, including closed and expired separately", () => {
    for (const status of ["active", "checkedOut", "expired", "preRegistered", "inactive"]) expect(isVisitorStatus(status)).toBe(true);
    for (const status of [null, "inside", "ended", "constructor", "__proto__"]) expect(isVisitorStatus(status)).toBe(false);
    expect(visitorStatusInfo.checkedOut).toEqual({ label: "Ziyaret sonlandırıldı", tone: "neutral" });
    expect(visitorStatusInfo.expired).toEqual({ label: "Süresi doldu", tone: "warning" });
  });
});
