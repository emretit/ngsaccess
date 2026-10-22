import { describe, expect, it } from "vitest";
import { accessBlockReason } from "./accountAccess";

describe("accessBlockReason", () => {
  it.each([
    [{}, 100, null],
    [{ disabledAt: 0 }, 100, "disabled"],
    [{ accessExpiresAt: 101 }, 100, null],
    [{ accessExpiresAt: 100 }, 100, "expired"],
    [{ accessExpiresAt: 99 }, 100, "expired"],
    [{ disabledAt: 1, accessExpiresAt: 99 }, 100, "disabled"],
  ] as const)("evaluates %j at %s", (user, now, expected) => {
    expect(accessBlockReason(user, now)).toBe(expected);
  });
});
