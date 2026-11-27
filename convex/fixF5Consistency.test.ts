// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { encodeEvidence, decodeEvidence } from "./lib/dashboardSummary";
import { toPdksTransport } from "./lib/pdksTransport";
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

it("project deletion removes all five dashboard projections and their PII, preserving foreign and global evidence", async () => {
  const f = await fixture();
  const seed = (projectId?: typeof f.projectId) => f.t.run(async ctx => {
    // An old/raw writer can leave derived rows after source deletion; these
    // projections must not block project deletion or become orphaned PII.
    const readingId = await ctx.db.insert("cardReadings", { projectId, cardNo: "SECRET-CARD", employeeName: "Private Person", accessTime: "2026-11-27T08:00:00Z" });
    const reading = await ctx.db.get(readingId);
    if (!reading) throw new Error("Missing fixture reading");
    const day = await ctx.db.insert("dashboardDays", { projectId, date: "2026-11-27", complete: true, formatVersion: 2 });
    const hour = await ctx.db.insert("dashboardHours", { projectId, date: "2026-11-27", hour: 11, total: 1, granted: 0, denied: 0 });
    const evidence = await ctx.db.insert("dashboardEvidence", { projectId, date: "2026-11-27", hour: 11, part: 0, count: 1, payload: encodeEvidence([toPdksTransport(reading)]) });
    const count = await ctx.db.insert("dashboardCounts", { projectId, kind: "employees", count: 0 });
    const feed = await ctx.db.insert("dashboardReadingFeed", { projectId, readingId, readingCreationTime: reading._creationTime, accessTime: reading.accessTime, cardNo: reading.cardNo, employeeName: reading.employeeName });
    await ctx.db.delete(readingId);
    return { ids: [day, hour, evidence, count, feed], evidence, feed };
  });
  const owned = await seed(f.projectId), foreign = await seed(f.otherProjectId), global = await seed();
  const impact = await f.admin.query(api.projects.getDeletionImpact, { projectId: f.projectId });
  expect(impact).toMatchObject({ canDelete: true, blockers: [] });
  expect(impact.cleanup.map(row => row.table)).toEqual(expect.arrayContaining([
    "dashboardDays", "dashboardHours", "dashboardEvidence", "dashboardCounts", "dashboardReadingFeed",
  ]));
  await f.admin.mutation(api.projects.remove, { id: f.projectId });
  await f.t.run(async ctx => {
    expect(await ctx.db.get(f.projectId)).toBeNull();
    for (const id of owned.ids) expect(await ctx.db.get(id)).toBeNull();
    for (const retained of [foreign, global]) {
      for (const id of retained.ids) expect(await ctx.db.get(id)).not.toBeNull();
      expect((await ctx.db.get(retained.feed))?.employeeName).toBe("Private Person");
      const evidence = await ctx.db.get(retained.evidence);
      if (!evidence) throw new Error("Foreign evidence must survive");
      expect(decodeEvidence(evidence.payload, evidence.projectId)[0]?.cardNo).toBe("SECRET-CARD");
    }
  });
});

it("a 60-day project deletes without the numeric 500-row lock and drains every dashboard table", async () => {
  vi.useFakeTimers();
  try {
    const f = await fixture();
    const foreign = await f.t.run(async ctx => {
      for (let day = 0; day < 60; day++) {
        const date = new Date(Date.UTC(2026, 8, day + 1)).toISOString().slice(0, 10);
        await ctx.db.insert("dashboardDays", { projectId: f.projectId, date, complete: true, formatVersion: 2 });
        for (let hour = 0; hour < 10; hour++) await ctx.db.insert("dashboardHours", {
          projectId: f.projectId, date, hour, shard: 0, total: 0, granted: 0, denied: 0,
        });
      }
      for (const kind of ["employees", "devices", "accessRules"] as const) await ctx.db.insert("dashboardCounts", { projectId: f.projectId, kind, count: 0 });
      const readingId = await ctx.db.insert("cardReadings", { projectId: f.projectId, cardNo: "PRIVATE", employeeName: "Private Person", accessTime: "2026-10-30T08:00:00Z" });
      const reading = await ctx.db.get(readingId);
      if (!reading) throw new Error("Missing reading fixture");
      await ctx.db.insert("dashboardReadingFeed", { projectId: f.projectId, readingId, readingCreationTime: reading._creationTime, accessTime: reading.accessTime, cardNo: reading.cardNo, employeeName: reading.employeeName });
      await ctx.db.insert("dashboardEvidence", { projectId: f.projectId, date: "2026-10-30", hour: 11, part: 0, count: 1, payload: encodeEvidence([toPdksTransport(reading)]) });
      await ctx.db.delete(readingId);
      return ctx.db.insert("dashboardHours", { projectId: f.otherProjectId, date: "2026-10-30", hour: 11, total: 1, granted: 1, denied: 0 });
    });
    expect((await f.admin.query(api.projects.getDeletionImpact, { projectId: f.projectId })).canDelete).toBe(true);
    await expect(f.admin.mutation(api.projects.remove, { id: f.projectId })).resolves.toBe(f.projectId);
    await f.t.run(async ctx => {
      expect(await ctx.db.get(f.projectId)).toBeNull();
      // Personal evidence is gone before any scheduled cleanup has run.
      expect(await ctx.db.query("dashboardReadingFeed").collect()).toEqual([]);
      expect(await ctx.db.query("dashboardEvidence").collect()).toEqual([]);
      expect((await ctx.db.query("dashboardHours").collect()).filter(row => row.projectId === f.projectId).length).toBeGreaterThan(0);
      expect(await ctx.db.system.query("_scheduled_functions").collect()).toHaveLength(1);
    });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await f.t.run(async ctx => {
      for (const table of ["dashboardHours", "dashboardDays", "dashboardCounts", "dashboardReadingFeed", "dashboardEvidence"] as const) {
        expect((await ctx.db.query(table).collect()).filter(row => row.projectId === f.projectId), table).toEqual([]);
      }
      expect(await ctx.db.get(foreign)).not.toBeNull();
    });
    // A stale retry is harmless, and an active project is never a cleanup target.
    await f.t.mutation(internal.projects.cleanupDashboardSummaries, { projectId: f.projectId });
    await f.t.mutation(internal.projects.cleanupDashboardSummaries, { projectId: f.otherProjectId });
    expect(await f.t.run(ctx => ctx.db.get(foreign))).not.toBeNull();
  } finally { vi.useRealTimers(); }
});

it.each(["dashboardReadingFeed", "dashboardEvidence"] as const)("%s retains its atomic PII limit and rolls back project deletion", async table => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const readingId = await ctx.db.insert("cardReadings", { projectId: f.projectId, cardNo: "PRIVATE", accessTime: "2026-10-30T08:00:00Z" });
    const reading = await ctx.db.get(readingId);
    if (!reading) throw new Error("Missing reading fixture");
    for (let i = 0; i < 501; i++) {
      if (table === "dashboardReadingFeed") await ctx.db.insert(table, { projectId: f.projectId, readingId, readingCreationTime: reading._creationTime, accessTime: reading.accessTime, cardNo: reading.cardNo });
      else await ctx.db.insert(table, { projectId: f.projectId, date: "2026-10-30", hour: 11, part: i, count: 1, payload: encodeEvidence([toPdksTransport(reading)]) });
    }
    await ctx.db.delete(readingId);
    await ctx.db.insert("dashboardCounts", { projectId: f.projectId, kind: "employees", count: 0 });
  });
  await expect(f.admin.mutation(api.projects.remove, { id: f.projectId })).rejects.toThrow("temizleme sınırı");
  await f.t.run(async ctx => {
    expect(await ctx.db.get(f.projectId)).not.toBeNull();
    expect(await ctx.db.query(table).collect()).toHaveLength(501);
    expect(await ctx.db.query("dashboardCounts").collect()).toHaveLength(1);
    expect(await ctx.db.system.query("_scheduled_functions").collect()).toEqual([]);
  });
});
