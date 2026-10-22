// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const password = "Synthetic-Current-2026";
const hash = bcrypt.hashSync(password, 4);
// 2026-10-19 15:00 İstanbul
const now = "2026-10-19T12:00:00.000Z";
const ended = { code: "EMPLOYMENT_ENDED", message: "İşten ayrıldığınız için mobil erişiminiz kapatıldı" };

async function fixture(fields: Partial<Doc<"employees">>) {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const employeeId = await t.run(async (ctx) => {
    const employeeId = await ctx.db.insert("employees", {
      firstName: "Synthetic", lastName: "Employee", email: "mobile@example.test",
      cardNumber: "synthetic-card", isActive: true, ...fields,
    });
    await ctx.db.insert("employeeAuth", { employeeId, passwordHash: hash, passwordVersion: 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("employeeSessions", {
      employeeId, token: "open-session", passwordVersion: 1, expiresAt: "2030-01-01T00:00:00.000Z", createdAt: now,
    });
    return employeeId;
  });
  return { t, employeeId };
}
const sessionCount = (t: Awaited<ReturnType<typeof fixture>>["t"]) =>
  t.run(async (ctx) => (await ctx.db.query("employeeSessions").collect()).length);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
});
afterEach(() => { vi.useRealTimers(); });

describe("mobile sign-in after the employment end date (Emre 2026-10-22)", () => {
  it.each([
    ["active until the cron closes it", true],
    ["already closed by the cron", false],
  ] as const)("returns EMPLOYMENT_ENDED for a correct password when %s", async (_label, isActive) => {
    const { t } = await fixture({ isActive, employmentEndDate: "2026-10-18" });
    await expect(t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password }))
      .resolves.toEqual({ error: ended });
    expect(await sessionCount(t)).toBe(1);
  });
  it("does not disclose the ended account to a wrong password", async () => {
    const { t } = await fixture({ employmentEndDate: "2026-10-18" });
    await expect(t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password: "Wrong-Password-2026" }))
      .resolves.toEqual({ error: { code: "INVALID_CREDENTIALS", message: "E-posta veya şifre hatalı" } });
  });
  it.each([
    ["the last day itself", { employmentEndDate: "2026-10-19" }],
    ["a future end date", { employmentEndDate: "2026-12-31" }],
    ["a visitor with a stale end date", { isVisitor: true, employmentEndDate: "2026-10-01" }],
  ] as const)("still signs in on %s", async (_label, fields) => {
    const { t } = await fixture(fields);
    await expect(t.mutation(api.employeeAuth.signIn, { email: "mobile@example.test", password }))
      .resolves.toMatchObject({ token: expect.any(String) });
  });
});

describe("open mobile sessions after the employment end date", () => {
  it.each([true, false])("rejects the next call with EMPLOYMENT_ENDED (isActive=%s)", async (isActive) => {
    const { t } = await fixture({ isActive, employmentEndDate: "2026-10-18" });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "open-session" }))
      .rejects.toMatchObject({ data: ended });
  });
  it("switches at Istanbul midnight after the last day", async () => {
    vi.setSystemTime(new Date("2026-10-19T20:59:59.000Z"));
    const { t } = await fixture({ employmentEndDate: "2026-10-19" });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "open-session" })).resolves.toBeTruthy();
    vi.setSystemTime(new Date("2026-10-19T21:00:00.000Z"));
    await expect(t.query(api.employeeAuth.me, { sessionToken: "open-session" }))
      .rejects.toMatchObject({ data: ended });
  });
  it("keeps EMPLOYEE_INACTIVE for a deactivated employee without an end date", async () => {
    const { t } = await fixture({ isActive: false });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "open-session" }))
      .rejects.toMatchObject({ data: { code: "EMPLOYEE_INACTIVE" } });
  });
  it("leaves a visitor's session governed by the existing rules", async () => {
    const { t } = await fixture({ isVisitor: true, employmentEndDate: "2026-10-01" });
    await expect(t.query(api.employeeAuth.me, { sessionToken: "open-session" })).resolves.toBeTruthy();
  });
});
