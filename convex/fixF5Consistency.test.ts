// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { grantEmployees } from "./lib/grantStatus";
import { assertIdeRosterMovable } from "./lib/deviceProvision";
import { projectDeletionMatrix, projectDeletionBlockingTables, projectDeletionCleanupTables } from "./lib/adminGuards";
const modules = import.meta.glob("./**/*.ts");

it("Y-09: every schema table with projectId occurs exactly once in the policy matrix", () => {
  const projectTables = Object.entries(schema.tables)
    .filter(([, table]) => table.validator.kind === "object" && "projectId" in table.validator.fields)
    .map(([name]) => name);
  expect(projectTables.length).toBeGreaterThan(40);
  expect(projectDeletionMatrix.map(entry => entry.table).sort()).toEqual(projectTables.sort());
  expect(new Set(projectDeletionMatrix.map(entry => entry.table)).size).toBe(projectDeletionMatrix.length);
  expect(projectDeletionCleanupTables).toEqual(projectDeletionMatrix.filter(entry => entry.policy === "delete").map(entry => entry.table));
  expect(projectDeletionBlockingTables).toEqual(projectDeletionMatrix.filter(entry => entry.policy === "block"));
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Silinecek" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Diğer" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const readerId = await ctx.db.insert("users", { role: "project_user" });
    const readerSessionId = await ctx.db.insert("authSessions", { userId: readerId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { projectId, userId: readerId, role: "viewer" });
    return { projectId, otherProjectId, userId, sessionId, readerId, readerSessionId };
  });
  return { t, ...ids, admin: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), reader: t.withIdentity({ subject: `${ids.readerId}|${ids.readerSessionId}` }) };
}

describe("Y-09 project deletion", () => {
  it("blocks a project containing request documents without deleting their stored bytes", async () => {
    const f = await fixture();
    const records = await f.t.run(async ctx => {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", cardNumber: "123", email: "ada@example.test" });
      const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "deleted-session", createdAt: "now", expiresAt: "2099-01-01T00:00:00Z" });
      const storageId = await ctx.storage.store(new Blob(["%PDF-private"], { type: "application/pdf" }));
      const attachmentId = await ctx.db.insert("requestAttachments", { employeeId, projectId: f.projectId, sessionId, name: "rapor.pdf", contentType: "application/pdf", size: 12, storageId, expiresAt: Date.now() + 86_400_000 });
      // A legacy orphan must still prevent project deletion until it is cleaned up.
      await ctx.db.delete(sessionId);
      await ctx.db.delete(employeeId);
      return { attachmentId, storageId };
    });
    const impact = await f.admin.query(api.projects.getDeletionImpact, { projectId: f.projectId });
    expect(impact.canDelete).toBe(false);
    expect(impact.blockers).toEqual([expect.objectContaining({ table: "requestAttachments", count: 1 })]);
    await expect(f.admin.mutation(api.projects.remove, { id: f.projectId })).rejects.toThrow("talep belgesi");
    await f.t.run(async ctx => {
      expect(await ctx.db.get(f.projectId)).not.toBeNull();
      expect(await ctx.db.get(records.attachmentId)).not.toBeNull();
      expect(await ctx.storage.get(records.storageId)).not.toBeNull();
    });
    expect((await f.admin.query(api.projects.getDeletionImpact, { projectId: f.otherProjectId })).canDelete).toBe(true);
  });
  it("deletes all request attachments and stored bytes on employee removal, preserving another employee's files", async () => {
    const f = await fixture();
    const records = await f.t.run(async ctx => {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", cardNumber: "123", email: "ada@example.test" });
      const otherId = await ctx.db.insert("employees", { projectId: f.otherProjectId, firstName: "Other", lastName: "Employee", cardNumber: "456", email: "other@example.test" });
      const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "owner", createdAt: "now", expiresAt: "2099-01-01T00:00:00Z" });
      const otherSessionId = await ctx.db.insert("employeeSessions", { employeeId: otherId, token: "other-owner", createdAt: "now", expiresAt: "2099-01-01T00:00:00Z" });
      const leaveId = await ctx.db.insert("leaves", { employeeId, projectId: f.projectId, leaveType: "sick", startDate: "2026-11-25", endDate: "2026-11-25", status: "approved", source: "employee", createdAt: "now", updatedAt: "now" });
      const correctionId = await ctx.db.insert("attendanceCorrections", { employeeId, projectId: f.projectId, date: "2026-11-25", correctionType: "checkIn", reason: "Giriş eksik", status: "pending", createdAt: "now", updatedAt: "now" });
      const owned = [];
      for (const link of [{ leaveId }, { correctionId }, { expiresAt: Date.now() + 86_400_000 }]) {
        const storageId = await ctx.storage.store(new Blob(["%PDF-private"], { type: "application/pdf" }));
        const id = await ctx.db.insert("requestAttachments", { employeeId, projectId: f.projectId, sessionId, name: "rapor.pdf", contentType: "application/pdf", size: 12, storageId, ...link });
        owned.push({ id, storageId });
      }
      const otherStorage = await ctx.storage.store(new Blob(["%PDF-other"], { type: "application/pdf" }));
      const otherAttachment = await ctx.db.insert("requestAttachments", { employeeId: otherId, projectId: f.otherProjectId, sessionId: otherSessionId, name: "other.pdf", contentType: "application/pdf", size: 10, storageId: otherStorage, expiresAt: Date.now() + 86_400_000 });
      return { employeeId, owned, otherAttachment, otherStorage };
    });
    await f.admin.mutation(api.employees.remove, { employeeId: records.employeeId });
    await f.t.run(async ctx => {
      expect(await ctx.db.get(records.employeeId)).toBeNull();
      for (const file of records.owned) {
        expect(await ctx.db.get(file.id)).toBeNull();
        expect(await ctx.storage.get(file.storageId)).toBeNull();
      }
      expect(await ctx.db.get(records.otherAttachment)).not.toBeNull();
      expect(await ctx.storage.get(records.otherStorage)).not.toBeNull();
    });
  });
  it("fails employee deletion atomically when the request attachment cleanup bound is exceeded", async () => {
    const f = await fixture();
    const records = await f.t.run(async ctx => {
      const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", cardNumber: "123", email: "ada@example.test" });
      const sessionId = await ctx.db.insert("employeeSessions", { employeeId, token: "owner", createdAt: "now", expiresAt: "2099-01-01T00:00:00Z" });
      const storageId = await ctx.storage.store(new Blob(["%PDF-private"], { type: "application/pdf" }));
      for (let i = 0; i < 1001; i++) await ctx.db.insert("requestAttachments", { employeeId, projectId: f.projectId, sessionId, name: "rapor.pdf", contentType: "application/pdf", size: 12, storageId, expiresAt: Date.now() + 86_400_000 });
      return { employeeId, sessionId, storageId };
    });
    await expect(f.admin.mutation(api.employees.remove, { employeeId: records.employeeId })).rejects.toThrow("talep geçmişi");
    await f.t.run(async ctx => {
      expect(await ctx.db.get(records.employeeId)).not.toBeNull();
      expect(await ctx.db.get(records.sessionId)).not.toBeNull();
      expect(await ctx.storage.get(records.storageId)).not.toBeNull();
      expect(await ctx.db.query("requestAttachments").withIndex("by_employeeId", q => q.eq("employeeId", records.employeeId)).take(1002)).toHaveLength(1001);
    });
  });
  it("preserves physical IDE roster ownership after project deletion", async () => {
    const f = await fixture();
    const rosterId = await f.t.run(async ctx => {
      const deviceId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Panel", status: "offline", createdAt: "now", updatedAt: "now" });
      const id = await ctx.db.insert("idePanelUsers", { projectId: f.projectId, deviceId, ideUuid: "retained-panel", cardNumber: "123", syncedAt: Date.now() });
      await ctx.db.delete(deviceId);
      return id;
    });
    const impact = await f.admin.query(api.projects.getDeletionImpact, { projectId: f.projectId });
    expect(impact.canDelete).toBe(true);
    expect(impact.cleanup.some(row => row.table === "idePanelUsers")).toBe(false);
    await f.admin.mutation(api.projects.remove, { id: f.projectId });
    expect(await f.t.run(ctx => ctx.db.get(rosterId))).toMatchObject({ projectId: f.projectId, cardNumber: "123" });
    await expect(f.t.run(ctx => assertIdeRosterMovable(ctx, "retained-panel", f.otherProjectId))).rejects.toThrow("IDE_DEVICE_MOVE_UNSUPPORTED");
    await expect(f.t.run(ctx => assertIdeRosterMovable(ctx, "unused-panel", f.otherProjectId))).resolves.toBeNull();
  });
  it("previews and deletes all four missing settings tables while preserving other projects and history", async () => {
    const f = await fixture();
    const records = await f.t.run(async ctx => {
      const version = await ctx.db.insert("pdksRuleVersions", { projectId: f.projectId, effectiveFrom: "2026-10-01", punchMode: "legacy", checkpointMode: "all", createdAt: "now", createdBy: f.userId });
      const deviceId = await ctx.db.insert("devices", { projectId: f.otherProjectId, name: "Other", status: "offline", createdAt: "now", updatedAt: "now" });
      const checkpoint = await ctx.db.insert("pdksCheckpointSelections", { projectId: f.projectId, ruleVersionId: version, targetType: "device", deviceId });
      const alarm = await ctx.db.insert("alarmSettings", { projectId: f.projectId, emailEnabled: false, recipients: [], minSeverity: "warning", updatedAt: "now" });
      const otherAlarm = await ctx.db.insert("alarmSettings", { projectId: f.otherProjectId, emailEnabled: false, recipients: [], minSeverity: "warning", updatedAt: "now" });
      const audit = await ctx.db.insert("auditLog", { projectId: f.projectId, userId: f.userId, action: "create", targetTable: "projects", targetId: String(f.projectId), timestamp: Date.now() });
      return { deleted: [version, checkpoint, alarm], otherAlarm, audit };
    });
    const impact = await f.admin.query(api.projects.getDeletionImpact, { projectId: f.projectId });
    expect(impact.canDelete).toBe(true);
    expect(impact.cleanup.map(row => row.table)).toEqual(expect.arrayContaining(["alarmSettings", "pdksRuleVersions", "pdksCheckpointSelections"]));
    await f.admin.mutation(api.projects.remove, { id: f.projectId });
    await f.t.run(async ctx => {
      for (const id of records.deleted) expect(await ctx.db.get(id)).toBeNull();
      expect(await ctx.db.get(records.otherAlarm)).not.toBeNull();
      expect(await ctx.db.get(records.audit)).not.toBeNull();
      expect(await ctx.db.get(f.projectId)).toBeNull();
    });
  });
  it("denies viewer preview/delete and blocks projects containing employees", async () => {
    const f = await fixture();
    await expect(f.reader.query(api.projects.getDeletionImpact, { projectId: f.projectId })).rejects.toThrow();
    await expect(f.reader.mutation(api.projects.remove, { id: f.projectId })).rejects.toThrow();
    await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", cardNumber: "123", email: "ada@example.test" }));
    expect((await f.admin.query(api.projects.getDeletionImpact, { projectId: f.projectId })).canDelete).toBe(false);
    await expect(f.admin.mutation(api.projects.remove, { id: f.projectId })).rejects.toThrow("personel");
  });
});

it("K-09: repeated grants read each employee once in a batch", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const employeeId = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Ada", lastName: "Test", cardNumber: "123", email: "a@example.test" });
    const reads = vi.spyOn(ctx.db, "get");
    try {
      const employees = await grantEmployees(ctx, Array.from({ length: 50 }, () => ({ employeeId })));
      expect(reads).toHaveBeenCalledTimes(1);
      expect(employees.get(employeeId)?.firstName).toBe("Ada");
    } finally { reads.mockRestore(); }
  });
});
it("Y-09: cleanup over its bound fails atomically instead of leaving partial cleanup", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 501; i++) await ctx.db.insert("alarmSettings", { projectId: f.projectId, emailEnabled: false, recipients: [], minSeverity: "warning", updatedAt: "now" });
  });
  const preview = await f.admin.query(api.projects.getDeletionImpact, { projectId: f.projectId });
  expect(preview.cleanup.find(row => row.table === "alarmSettings")).toMatchObject({ count: 100, capped: true });
  await expect(f.admin.mutation(api.projects.remove, { id: f.projectId })).rejects.toThrow("temizleme sınırı");
  await f.t.run(async ctx => {
    expect(await ctx.db.get(f.projectId)).not.toBeNull();
    expect(await ctx.db.query("alarmSettings").withIndex("by_project", q => q.eq("projectId", f.projectId)).take(502)).toHaveLength(501);
    expect(await ctx.db.query("userProjects").withIndex("by_project", q => q.eq("projectId", f.projectId)).take(2)).toHaveLength(1);
  });
});
