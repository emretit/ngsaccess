// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";

const mail = vi.hoisted(() => vi.fn());
vi.mock("../lib/projectMailer", () => ({ deliverProjectMail: mail }));
const modules = import.meta.glob("/convex/**/*.ts");
const now = Date.parse("2026-11-01T09:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); mail.mockReset(); });
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const scheduleId = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Reports" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role: "admin" });
    return ctx.db.insert("reportScheduleSettings", {
      userId, projectId, reportType: "sgk", email: "original@example.test", enabled: true,
      createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
    });
  });
  return { t, scheduleId, args: { scheduleId, year: 2026, month: 10 } };
}

it("records the failed attempt, retries with backoff, and never sends a sent period again", async () => {
  const { t, args, scheduleId } = await fixture();
  mail.mockResolvedValueOnce({ ok: false, channel: "smtp", error: "Temporary" })
    .mockResolvedValue({ ok: true, channel: "smtp" });
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  const first = await t.run(ctx => ctx.db.query("reportDeliveries").unique());
  expect(first).toMatchObject({ status: "retryScheduled", attempts: 1, error: "Temporary", nextRetryAt: now + 60_000 });
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  expect(mail).toHaveBeenCalledTimes(1);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").unique())).toMatchObject({ status: "sent", attempts: 2, email: "original@example.test" });
  expect((await t.run(ctx => ctx.db.get(scheduleId)))?.lastSentAt).toEqual(expect.any(String));
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  await t.action(internal.actions.sendScheduledReports.sendMonthlyReports, {});
  expect(mail).toHaveBeenCalledTimes(2);
});

it("stops after three failures and retains the terminal failure", async () => {
  const { t, args } = await fixture();
  mail.mockRejectedValue(new Error("Unavailable"));
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").unique())).toMatchObject({ status: "failed", attempts: 3, error: "Unavailable" });
  expect(mail).toHaveBeenCalledTimes(3);
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  expect(mail).toHaveBeenCalledTimes(3);
});

it("claims a period once even when two actions start concurrently", async () => {
  const { t, args } = await fixture();
  mail.mockResolvedValue({ ok: true, channel: "smtp" });
  await Promise.all([
    t.action(internal.actions.sendScheduledReports.sendReportDelivery, args),
    t.action(internal.actions.sendScheduledReports.sendReportDelivery, args),
  ]);
  expect(mail).toHaveBeenCalledTimes(1);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("closes an abandoned sending claim after one hour without resending", async () => {
  const { t, args } = await fixture();
  const delivery = await t.mutation(internal.reports.claimReportDelivery, args);
  expect(delivery?.status).toBe("sending");
  if (!delivery) throw new Error("Missing delivery");
  await t.mutation(internal.reports.expireReportDelivery, { deliveryId: delivery._id, attempt: 1 });
  expect((await t.run(ctx => ctx.db.get(delivery._id)))?.status).toBe("sending");
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(delivery._id))).toMatchObject({ status: "failed", error: "outcome_unknown", attempts: 1 });
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  expect(mail).not.toHaveBeenCalled();
});

it("keeps delivery tied to the original recipient without marking a newly edited schedule sent", async () => {
  const { t, args, scheduleId } = await fixture();
  mail.mockImplementationOnce(async () => {
    await t.run(ctx => ctx.db.patch(scheduleId, { email: "new@example.test", updatedAt: new Date(now + 1).toISOString() }));
    return { ok: true, channel: "smtp" };
  });
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  expect(mail.mock.calls[0][2].to).toBe("original@example.test");
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").unique())).toMatchObject({ status: "sent", email: "original@example.test" });
  expect((await t.run(ctx => ctx.db.get(scheduleId)))?.lastSentAt).toBeUndefined();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("skips a retry if its schedule changed or was disabled", async () => {
  const { t, args, scheduleId } = await fixture();
  mail.mockResolvedValue({ ok: false, channel: "smtp", error: "Temporary" });
  await t.action(internal.actions.sendScheduledReports.sendReportDelivery, args);
  await t.run(ctx => ctx.db.patch(scheduleId, { enabled: false }));
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("reportDeliveries").unique())).toMatchObject({ status: "skipped", attempts: 1 });
  expect(mail).toHaveBeenCalledTimes(1);
});

it("rejects a changed schedule before rendering mail and ignores stale attempt results", async () => {
  const { t, args, scheduleId } = await fixture();
  const first = await t.mutation(internal.reports.claimReportDelivery, args);
  if (!first) throw new Error("Missing delivery");
  await t.mutation(internal.reports.finishReportDelivery, {
    deliveryId: first._id, attempt: 1, outcome: "failed", error: "Temporary",
  });
  vi.setSystemTime(now + 60_000);
  const retry = await t.mutation(internal.reports.claimReportDelivery, args);
  expect(retry?.attempts).toBe(2);
  await t.mutation(internal.reports.finishReportDelivery, {
    deliveryId: first._id, attempt: 1, outcome: "sent",
  });
  expect((await t.run(ctx => ctx.db.get(first._id)))?.status).toBe("sending");
  await t.run(ctx => ctx.db.patch(scheduleId, { email: "changed@example.test" }));
  expect(await t.query(internal.reports.getReportSummaryForEmail, { ...args, deliveryId: first._id })).toBeNull();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.get(first._id))).toMatchObject({ status: "failed", error: "outcome_unknown" });
  expect(mail).not.toHaveBeenCalled();
});
