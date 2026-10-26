// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { resolveScheduleScope, selectScheduleProjectIds } from "./lib/reportScope";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
type ProjectRole = NonNullable<Doc<"userProjects">["role"]>;
async function fixture(role: ProjectRole = "hr") {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Owned" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Foreign" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const employeeId = await ctx.db.insert("employees", {
      projectId, firstName: "Kayit", lastName: "Personel", email: "record@example.test", cardNumber: "123", isActive: true,
    });
    await ctx.db.insert("projectPrivacySettings", { projectId, aiMaskNames: false, updatedAt: new Date().toISOString() });
    await ctx.db.insert("cardReadings", {
      projectId, employeeId, employeeName: "Kayit Personel", accessTime: "2026-10-25T10:00:00.000Z", cardNo: "123", accessStatus: "izin_verildi",
    });
    return { projectId, otherProjectId, userId, sessionId, employeeId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("F0-B side-door authorization", () => {
  it.each(["viewer", "security", "technician"] as const)("%s cannot issue setup emails", async role => {
    const f = await fixture(role);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(f.caller.action(api.actions.sendEmail.sendEmployeeSetupEmail, { employeeId: f.employeeId })).rejects.toThrow("yetkiniz yok");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await f.t.run(ctx => ctx.db.query("employeeAuth").collect())).toHaveLength(0);
  });

  it("hr sends to the recorded address, overwrites stale auth scope, audits a masked address and observes cooldown", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "test-mail" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("employeeAuth", { employeeId: f.employeeId, projectId: f.otherProjectId,
      email: "stale@example.test", createdAt: "old", updatedAt: "old" }));
    await expect(f.caller.action(api.actions.sendEmail.sendEmployeeSetupEmail, { employeeId: f.employeeId })).resolves.toEqual({ success: true });
    const auth = await f.t.run(ctx => ctx.db.query("employeeAuth").unique());
    expect(auth).toMatchObject({ email: "record@example.test", projectId: f.projectId, setupToken: expect.any(String) });
    expect(fetchMock).toHaveBeenCalledOnce();
    const request: unknown = fetchMock.mock.calls[0];
    expect(JSON.stringify(request)).toContain("record@example.test");
    expect(JSON.stringify(request)).toContain("Kayit Personel");
    const audits = await f.t.run(ctx => ctx.db.query("auditLog").collect());
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ userId: f.userId, targetId: f.employeeId, newValue: { employeeId: f.employeeId, email: "r***@example.test" } });
    expect(JSON.stringify(audits)).not.toContain("record@example.test");
    await expect(f.caller.action(api.actions.sendEmail.sendEmployeeSetupEmail, { employeeId: f.employeeId })).rejects.toThrow("60 saniye");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect((await f.t.run(ctx => ctx.db.query("employeeAuth").unique()))?.setupToken).toBe(auth?.setupToken);
  });

  it("hr can create canonical auth and issue another token after a full minute", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    await f.caller.mutation(internal.employeeAuth.issueSetupEmailToken, { employeeId: f.employeeId, setupToken: "first" });
    expect(await f.t.run(ctx => ctx.db.query("employeeAuth").unique())).toMatchObject({ projectId: f.projectId, email: "record@example.test", setupToken: "first" });
    vi.advanceTimersByTime(60000);
    await f.caller.mutation(internal.employeeAuth.issueSetupEmailToken, { employeeId: f.employeeId, setupToken: "second" });
    expect((await f.t.run(ctx => ctx.db.query("employeeAuth").unique()))?.setupToken).toBe("second");
  });

  it.each([
    { isVisitor: true }, { isActive: false }, { employmentEndDate: "2000-01-01" }, { email: " " },
  ])("rejects unavailable setup targets %j", async patch => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, patch));
    await expect(f.caller.mutation(internal.employeeAuth.issueSetupEmailToken, { employeeId: f.employeeId, setupToken: "no" })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("employeeAuth").collect())).toHaveLength(0);
  });

  it("rejects foreign project setup and assistant context", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { projectId: f.otherProjectId }));
    await expect(f.caller.action(api.actions.sendEmail.sendEmployeeSetupEmail, { employeeId: f.employeeId })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.query(internal.privacyRetention.getAssistantContext, { projectId: f.otherProjectId })).rejects.toThrow("yetkiniz yok");
  });

  it("requires reports.view and always masks names when employees.view is absent", async () => {
    const f = await fixture("viewer");
    expect(await f.caller.query(internal.privacyRetention.getAssistantContext, { projectId: f.projectId })).toContain("Kayit Personel");
    const permissionId = await f.t.run(ctx => ctx.db.insert("projectRolePermissions", {
      projectId: f.projectId, role: "viewer", permissions: ["reports.view"], updatedAt: Date.now(), updatedBy: f.userId,
    }));
    const masked = await f.caller.query(internal.privacyRetention.getAssistantContext, { projectId: f.projectId, forceMaskNames: false });
    expect(masked).toContain("Personel 1");
    expect(masked).not.toContain("Kayit Personel");
    await f.t.run(ctx => ctx.db.patch(permissionId, { permissions: ["employees.view"] }));
    await expect(f.caller.query(internal.privacyRetention.getAssistantContext, { projectId: f.projectId })).rejects.toThrow("yetkiniz yok");
  });

  it.each(["viewer", "hr"] as const)("photo URLs require employees.manage for %s", async role => {
    const f = await fixture(role);
    const storageId = await f.t.run(async ctx => {
      const id = await ctx.storage.store(new Blob(["photo"]));
      await ctx.db.patch(f.employeeId, { photoStorageId: id });
      return id;
    });
    if (role === "viewer") await expect(f.caller.mutation(api.files.getUploadUrl, { storageId })).rejects.toThrow("yetkiniz yok");
    else {
      await expect(f.caller.mutation(api.files.getUploadUrl, { storageId })).resolves.toEqual(expect.any(String));
      await f.t.run(ctx => ctx.db.patch(f.employeeId, { projectId: f.otherProjectId }));
      await expect(f.caller.mutation(api.files.getUploadUrl, { storageId })).rejects.toThrow("yetkiniz yok");
    }
  });

  it.each(["viewer", "hr"] as const)("calendar returns only the permitted DTO for %s", async role => {
    const f = await fixture(role);
    const leaveId = await f.t.run(ctx => ctx.db.insert("leaves", { projectId: f.projectId, employeeId: f.employeeId,
      startDate: "2026-10-01", endDate: "2026-10-02", leaveType: "sick", status: "approved", notes: "private", decisionNote: "decision",
      createdAt: "now", updatedAt: "now", approvedBy: f.userId }));
    const range = { projectId: f.projectId, startDate: "2026-10-01", endDate: "2026-10-31" };
    const rows = await f.caller.query(api.leaves.listForRange, range);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ _id: leaveId, employeeId: f.employeeId, leaveType: "sick", status: "approved" });
    expect(Object.keys(rows[0]).sort()).toEqual(["_id", "employeeId", "startDate", "endDate", "leaveType", "status", ...(role === "hr" ? ["notes", "decisionNote"] : [])].sort());
    if (role === "hr") expect(rows[0]).toMatchObject({ notes: "private", decisionNote: "decision" });
    await expect(f.caller.query(api.leaves.listForRange, { ...range, projectId: f.otherProjectId })).rejects.toThrow();
  });

  it.each(["active", "disabled", "expired"] as const)("scheduled scope respects %s accounts", async state => {
    const f = await fixture();
    const result = await f.t.run(async ctx => {
      await ctx.db.patch(f.userId, state === "disabled" ? { disabledAt: Date.now() } : state === "expired" ? { accessExpiresAt: Date.now() - 1 } : {});
      const scheduleId = await ctx.db.insert("reportScheduleSettings", { userId: f.userId, projectId: f.projectId,
        enabled: true, reportType: "attendance", email: "report@example.test", createdAt: "now", updatedAt: "now" });
      const schedule = await ctx.db.get(scheduleId);
      const user = await ctx.db.get(f.userId);
      if (!schedule) throw new Error("Schedule missing");
      return { selected: selectScheduleProjectIds(user, [f.projectId], f.projectId), resolved: await resolveScheduleScope(ctx, schedule) };
    });
    if (state === "active") expect(result).toMatchObject({ selected: [f.projectId], resolved: { projectIds: [f.projectId] } });
    else expect(result).toEqual({ selected: null, resolved: null });
  });
});
