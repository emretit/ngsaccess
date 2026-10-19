import { describe, expect, it, vi } from "vitest";
import { saveOvertime } from "../settings";
import { getEffectiveOvertimeRates } from "./pdksHelpers";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("./customFunctions", () => {
  const register = (config: unknown) => config;
  return {
    authedQuery: register,
    adminQuery: register,
    optionalAuthQuery: register,
    adminMutation: register,
  };
});
vi.mock("./auth", () => ({ getProjectIdsForUser: async () => ["p"] }));
vi.mock("./audit", () => ({ writeAudit: vi.fn() }));
const projectId = "p" as Id<"projects">;
const values = {
  projectId,
  annualOvertimeLimitHours: 270,
  overtimeStartToleranceMinutes: 15,
  monthlyHoursBase: 225,
  weekdayMultiplier: 1.5,
  weekendMultiplier: 2,
  holidayMultiplier: 2,
  nightShiftMultiplier: 1.5,
  nightShiftStart: "22:00",
  nightShiftEnd: "06:00",
};
function fixture(stored?: object) {
  const insert = vi.fn(async () => "rate");
  const chain = { withIndex: () => chain, first: async () => stored ?? null };
  return {
    ctx: {
      user: { _id: "u", role: "super_admin" },
      db: { query: () => chain, insert, patch: vi.fn() },
    } as unknown as MutationCtx,
    insert,
  };
}
const handler = (
  saveOvertime as unknown as {
    handler: (ctx: MutationCtx, args: object) => Promise<void>;
  }
).handler;
describe("13-H1 stored night combination policy", () => {
  it.each([undefined, "max", "multiply", "additive"] as const)(
    "persists %s and resolves the read default to max",
    async (nightCombineMode) => {
      const { ctx, insert } = fixture();
      await handler(ctx, { ...values, nightCombineMode });
      expect(insert).toHaveBeenCalledWith(
        "overtimeRates",
        expect.objectContaining({
          nightCombineMode: nightCombineMode ?? "max",
        }),
      );
      const stored = fixture({ ...values, nightCombineMode }).ctx;
      expect(
        (await getEffectiveOvertimeRates(stored, projectId)).nightCombineMode,
      ).toBe(nightCombineMode ?? "max");
    },
  );
  it("rejects a zero-length night window before writing settings", async () => {
    const { ctx, insert } = fixture();
    await expect(
      handler(ctx, { ...values, nightShiftEnd: "22:00" }),
    ).rejects.toThrow("Gece başlangıcı ve bitişi farklı olmalı.");
    expect(insert).not.toHaveBeenCalled();
  });
});
