// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { notifyAlarmIfNeeded } from "./lib/alarmNotify";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-10-22T12:00:00Z");
const originalApiKey = process.env.RESEND_API_KEY;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); process.env.RESEND_API_KEY = "test"; });
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllGlobals();
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalApiKey;
});
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Proje" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer" });
    const userId = await ctx.db.insert("users", { role: "project_user" });
    const adminId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + 86400000 });
    const adminSessionId = await ctx.db.insert("authSessions", { userId: adminId, expirationTime: now + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("userProjects", { userId: adminId, projectId });
    const settingsId = await ctx.db.insert("alarmSettings", { projectId, emailEnabled: true, recipients: ["first@example.com", "second@example.com"], minSeverity: "warning", updatedAt: new Date(now).toISOString() });
    const deviceId = await ctx.db.insert("devices", { name: "Panel", brand: "other", projectId, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() });
    const eventId = await ctx.db.insert("deviceEvents", { projectId, deviceId, source: "system", category: "exception", severity: "warning", label: "Arıza", eventTime: new Date(now).toISOString(), createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() });
    return { projectId, otherProjectId, userId, adminId, sessionId, adminSessionId, settingsId, eventId };
  });
  return { t, ...ids, user: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), admin: t.withIdentity({ subject: `${ids.adminId}|${ids.adminSessionId}` }) };
}

describe("alarm delivery pipeline", () => {
  it("records failure, waits five minutes and retries only failed recipients exactly once", async () => {
    const f = await fixture();
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 })).mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await f.t.run(ctx => notifyAlarmIfNeeded(ctx, f.eventId));
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "queued", alarmEmailAttempts: 0 });
    await vi.advanceTimersByTimeAsync(0); await f.t.finishInProgressScheduledFunctions();
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "retryScheduled", alarmEmailAttempts: 1, alarmEmailRetryAt: new Date(now + 300000).toISOString(), alarmEmailRecipients: ["second@example.com"] });
    expect(await f.admin.query(api.alarms.getSettings, { projectId: f.projectId })).toMatchObject({ lastEmail: { status: "retryScheduled", attempts: 1, error: "E-posta servisi HTTP 503 hatası verdi" } });
    await vi.advanceTimersByTimeAsync(299999); await f.t.finishInProgressScheduledFunctions();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); await f.t.finishInProgressScheduledFunctions();
    const event = await f.t.run(ctx => ctx.db.get(f.eventId));
    expect(event).toMatchObject({ alarmEmailStatus: "failed", alarmEmailAttempts: 2 });
    expect(event?.alarmNotifiedAt).toBeUndefined(); expect(event?.alarmEmailRetryAt).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body)) as { to: string[] };
    expect(retryBody.to).toEqual(["second@example.com"]);
    await f.t.action(internal.actions.sendAlarmEmail.send, { eventId: f.eventId, attempt: 2 });
    await vi.advanceTimersByTimeAsync(86400000); await f.t.finishInProgressScheduledFunctions();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("marks success only after service acceptance, hides recipient snapshots and skips duplicate actions", async () => {
    const f = await fixture();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 })); vi.stubGlobal("fetch", fetchMock);
    await f.t.run(ctx => notifyAlarmIfNeeded(ctx, f.eventId));
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "sent", alarmEmailAttempts: 1, alarmNotifiedAt: new Date(now).toISOString() });
    await f.t.action(internal.actions.sendAlarmEmail.send, { eventId: f.eventId });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const result = await f.user.query(api.alarms.list, { projectId: f.projectId, category: "exception", status: "all", paginationOpts: { numItems: 10, cursor: null } });
    expect(result.page[0]).not.toHaveProperty("alarmEmailRecipients");
  });
  it("rejects project_user and other projects, rate limits admin tests, and surfaces the test result", async () => {
    const f = await fixture();
    await expect(f.user.mutation(api.alarms.testEmail, { projectId: f.projectId })).rejects.toThrow("yetkiniz yok");
    await expect(f.admin.mutation(api.alarms.testEmail, { projectId: f.otherProjectId })).rejects.toThrow("erişim yetkiniz yok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await f.admin.mutation(api.alarms.testEmail, { projectId: f.projectId });
    await expect(f.admin.mutation(api.alarms.testEmail, { projectId: f.projectId })).rejects.toThrow("5 dakika");
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.admin.query(api.alarms.getSettings, { projectId: f.projectId })).toMatchObject({ lastEmail: { status: "sent", test: true } });
  });
  it("reclaims only a stale first sending attempt and never permits a third send", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.eventId, { alarmEmailStatus: "queued", alarmEmailAttempts: 0, alarmEmailRecipients: ["first@example.com"] }));
    expect(await f.t.mutation(internal.alarms.claimEmail, { eventId: f.eventId, attempt: 1 })).not.toBeNull();
    expect(await f.t.mutation(internal.alarms.claimEmail, { eventId: f.eventId, attempt: 1 })).toBeNull();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(await f.t.mutation(internal.alarms.claimEmail, { eventId: f.eventId, attempt: 2 })).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(await f.t.mutation(internal.alarms.claimEmail, { eventId: f.eventId, attempt: 2 })).not.toBeNull();
    // A late first action cannot overwrite the reclaimed second attempt.
    await f.t.mutation(internal.alarms.recordEmailResult, { eventId: f.eventId, attempt: 1, failedRecipients: [] });
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "sending", alarmEmailAttempts: 2 });
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    for (const attempt of [1, 2, 3]) expect(await f.t.mutation(internal.alarms.claimEmail, { eventId: f.eventId, attempt })).toBeNull();
    await f.t.mutation(internal.alarms.recordEmailResult, { eventId: f.eventId, attempt: 2, failedRecipients: ["first@example.com"], error: "E-posta gönderilemedi" });
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "failed", alarmEmailAttempts: 2 });
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(0);
  });
  it("stops a queued delivery when alarm email is disabled", async () => {
    const f = await fixture(); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await f.t.run(ctx => notifyAlarmIfNeeded(ctx, f.eventId));
    await f.t.run(ctx => ctx.db.patch(f.settingsId, { emailEnabled: false }));
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "skipped" });
  });
});
