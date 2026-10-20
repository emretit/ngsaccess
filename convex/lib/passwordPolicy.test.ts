import { describe, expect, it, vi } from "vitest";
import type { ActionCtx } from "../_generated/server";
import { adminSetEmployeePassword, setEmployeePassword } from "../actions/setPassword";
import {
  getPasswordChecks,
  getPasswordError,
  isPasswordValid,
  PASSWORD_POLICY_MESSAGE,
} from "./passwordPolicy";

describe("new password policy", () => {
  it.each([
    ["", false],
    ["Aa12345", false],
    ["Aa123456", true],
    ["abcdefgh1", false],
    ["ABCDEFGH1", false],
    ["Abcdefgh", false],
    ["12345678", false],
    ["Abcdef1!", true],
    ["Abcdef1 ", true],
    [" Strongpass1 ", true],
    ["Şş123456", false],
  ])("validates %j consistently across predicate and message APIs", (password, valid) => {
    expect(isPasswordValid(password)).toBe(valid);
    expect(getPasswordError(password)).toBe(valid ? null : PASSWORD_POLICY_MESSAGE);
  });

  it.each([
    ["Aa12345", "minLength"],
    ["abcdefg1", "hasUpper"],
    ["ABCDEFG1", "hasLower"],
    ["Abcdefgh", "hasNumber"],
  ] as const)("reports only the unmet requirement for %s", (password, missing) => {
    const checks = getPasswordChecks(password);
    for (const [requirement, satisfied] of Object.entries(checks)) {
      expect(satisfied).toBe(requirement !== missing);
    }
  });

  it("keeps every UI requirement satisfied for a valid password", () => {
    expect(getPasswordChecks("Aa123456")).toEqual({
      minLength: true,
      hasUpper: true,
      hasLower: true,
      hasNumber: true,
    });
  });

  it("returns the Turkish recovery message", () => {
    expect(getPasswordError("weakpass")).toBe(
      "Şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir.",
    );
  });
});

// Exercise the registered production actions: weak input must never reach hashing
// or credential writes, including the internal admin shortcut.
describe("employee password setters", () => {
  type Handler = (ctx: ActionCtx, args: { token: string; email: string; password: string }) =>
    Promise<{ success: boolean; error?: string }>;
  const setters = [
    ["setup", (setEmployeePassword as unknown as { _handler: Handler })._handler],
    ["admin", (adminSetEmployeePassword as unknown as { _handler: Handler })._handler],
  ] as const;

  it.each(setters)("%s rejects each unmet requirement before accessing credentials", async (_name, handler) => {
    for (const password of ["Aa12345", "abcdefg1", "ABCDEFG1", "Abcdefgh"]) {
      const runQuery = vi.fn();
      const runMutation = vi.fn();
      const ctx = { runQuery, runMutation } as unknown as ActionCtx;
      await expect(handler(ctx, { token: "setup-token", email: "user@example.test", password }))
        .resolves.toEqual({ success: false, error: PASSWORD_POLICY_MESSAGE });
      expect(runQuery).not.toHaveBeenCalled();
      expect(runMutation).not.toHaveBeenCalled();
    }
  });
});
