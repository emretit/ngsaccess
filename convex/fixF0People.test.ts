// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { ProjectRole } from "./lib/roleCatalog";

const modules = import.meta.glob("./**/*.ts");
const person = { firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "12345" };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture(role: ProjectRole = "hr") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const employeeId = await ctx.db.insert("employees", { ...person, projectId, isActive: true });
    const visitorId = await ctx.db.insert("employees", { ...person, projectId, email: "visitor@example.test", cardNumber: "56789", tcNo: "12345678901", isVisitor: true, isActive: true });
    const otherEmployeeId = await ctx.db.insert("employees", { ...person, projectId: otherProjectId, cardNumber: "OTHER" });
    const otherVisitorId = await ctx.db.insert("employees", { ...person, projectId: otherProjectId, cardNumber: "FOREIGN", isVisitor: true });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true });
    const otherRuleId = await ctx.db.insert("accessRules", { projectId: otherProjectId, name: "Other rule", isActive: true });
    return { projectId, otherProjectId, userId, sessionId, employeeId, visitorId, otherEmployeeId, otherVisitorId, ruleId, otherRuleId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const snapshot = () => t.run(async ctx => ({
    employees: await ctx.db.query("employees").collect(),
    members: await ctx.db.query("groupMembers").collect(),
    jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    audit: await ctx.db.query("auditLog").collect(),
  }));
  return { t, caller, snapshot, ...ids };
}

describe("K-01: employee form membership permission", () => {
  it("HR creates and edits ordinary fields but cannot add rule memberships", async () => {
    const f = await fixture();
    const created = await f.caller.mutation(api.employees.create, { ...person, email: "new@example.test", cardNumber: "NEW", projectId: f.projectId });
    await f.caller.mutation(api.employees.update, { employeeId: created, firstName: "Yeni" });
    expect((await f.t.run(ctx => ctx.db.get(created)))?.firstName).toBe("Yeni");
    const before = await f.snapshot();
    await expect(f.caller.mutation(api.employees.create, { ...person, email: "denied@example.test", cardNumber: "DENIED", projectId: f.projectId, accessRuleId: f.ruleId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, accessRuleId: f.ruleId, notes: "Must roll back" })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(await f.snapshot()).toEqual(before);
  });

  it("an access manager creates and adds memberships once, rejecting foreign rules and projects", async () => {
    const f = await fixture("admin");
    const created = await f.caller.mutation(api.employees.create, { ...person, email: "new@example.test", cardNumber: "NEW", projectId: f.projectId, accessRuleId: f.ruleId });
    await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, accessRuleId: f.ruleId });
    await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, accessRuleId: f.ruleId });
    expect((await f.snapshot()).members.map(row => row.employeeId).sort()).toEqual([created, f.employeeId].sort());
    const before = await f.snapshot();
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, accessRuleId: f.otherRuleId })).rejects.toThrow("aynı projede");
    await expect(f.caller.mutation(api.employees.create, { ...person, projectId: f.otherProjectId, accessRuleId: f.otherRuleId })).rejects.toThrow("yetkiniz yok");
    expect(await f.snapshot()).toEqual(before);
  });
});

describe("K-02: project moves are blocked", () => {
  it("rejects even an admin of both projects before modifying the record or scheduling work", async () => {
    const f = await fixture("admin");
    await f.t.run(ctx => ctx.db.insert("userProjects", { userId: f.userId, projectId: f.otherProjectId, role: "admin" }));
    const before = await f.snapshot();
    await expect(f.caller.mutation(api.employees.update, { employeeId: f.employeeId, projectId: f.otherProjectId, cardNumber: "MOVED" })).rejects.toThrow("EMPLOYEE_PROJECT_MOVE_UNSUPPORTED");
    expect(await f.snapshot()).toEqual(before);
    await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, projectId: f.projectId, notes: "Aynı proje" });
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.notes).toBe("Aynı proje");
  });
});

describe("K-03: generic employee endpoints exclude visitors", () => {
  it.each(["viewer", "hr"] as const)("%s gets no visitor through getById, while visitor detail stays masked", async role => {
    const f = await fixture(role);
    expect(await f.caller.query(api.employees.getById, { employeeId: f.visitorId })).toBeNull();
    expect(await f.caller.query(api.visitors.getDetail, { visitorId: f.visitorId })).toMatchObject({ cardNumber: "•••• 6789", tcNo: "•••• 8901", sensitiveMasked: true });
    expect(await f.caller.query(api.employees.getById, { employeeId: f.employeeId })).toMatchObject(person);
    expect(await f.caller.query(api.employees.getById, { employeeId: f.otherVisitorId })).toBeNull();
  });

  it("security sees the same sensitive fields as visitors.getDetail, with revocation taking effect", async () => {
    const f = await fixture("security");
    const employee = await f.caller.query(api.employees.getById, { employeeId: f.visitorId });
    const visitor = await f.caller.query(api.visitors.getDetail, { visitorId: f.visitorId });
    expect(employee).toMatchObject({ cardNumber: visitor?.cardNumber, tcNo: visitor?.tcNo, sensitiveMasked: false });
    await f.t.run(ctx => ctx.db.insert("projectRolePermissions", { projectId: f.projectId, role: "security", permissions: ["employees.view"], updatedAt: Date.now(), updatedBy: f.userId }));
    expect(await f.caller.query(api.employees.getById, { employeeId: f.visitorId })).toBeNull();
  });

  it.each(["update", "remove", "bulkDelete", "assignCards"] as const)("HR cannot use %s to change a visitor; mixed batches remain atomic", async method => {
    const f = await fixture();
    const before = await f.snapshot();
    const invoke = () => {
      switch (method) {
        case "update": return f.caller.mutation(api.employees.update, { employeeId: f.visitorId, notes: "Forbidden" });
        case "remove": return f.caller.mutation(api.employees.remove, { employeeId: f.visitorId });
        case "bulkDelete": return f.caller.mutation(api.employees.bulkDelete, { employeeIds: [f.employeeId, f.visitorId] });
        case "assignCards": return f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "NEW" }, { employeeId: f.visitorId, cardNumber: "VISITOR" }] });
      }
    };
    await expect(invoke()).rejects.toThrow("VISITOR_USE_VISITOR_SCREEN");
    expect(await f.snapshot()).toEqual(before);
  });

  it.each(["update", "remove", "bulkDelete", "assignCards"] as const)("HR can %s ordinary employees but cannot reach another project's record", async method => {
    const f = await fixture();
    switch (method) {
      case "update":
        await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, notes: "Allowed" });
        await expect(f.caller.mutation(api.employees.update, { employeeId: f.otherEmployeeId, notes: "Forbidden" })).rejects.toThrow("yetkiniz yok");
        break;
      case "remove":
        await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
        await expect(f.caller.mutation(api.employees.remove, { employeeId: f.otherEmployeeId })).rejects.toThrow("yetkiniz yok");
        break;
      case "bulkDelete":
        await f.caller.mutation(api.employees.bulkDelete, { employeeIds: [f.employeeId] });
        await expect(f.caller.mutation(api.employees.bulkDelete, { employeeIds: [f.otherEmployeeId] })).rejects.toThrow("yetkiniz yok");
        break;
      case "assignCards":
        expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "NEW" }] })).toMatchObject([{ status: "assigned" }]);
        expect(await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.otherEmployeeId, cardNumber: "FOREIGN" }] })).toMatchObject([{ status: "error" }]);
        break;
    }
    expect((await f.t.run(ctx => ctx.db.get(f.otherEmployeeId)))?.cardNumber).toBe("OTHER");
  });
});

describe("K-06: visitor deletion uses the employee deletion lifecycle", () => {
  it("security deletes a visitor, preserves Hik/IDE targets and runs the dependency and privacy cascade", async () => {
    const f = await fixture("security");
    const ids = await f.t.run(async ctx => {
      const base = { projectId: f.projectId, name: "Device", isActive: true, status: "online", createdAt: "", updatedAt: "" };
      const hikId = await ctx.db.insert("devices", { ...base, brand: "hikvision", hikDevIndex: "synthetic-hik" });
      const ideId = await ctx.db.insert("devices", { ...base, brand: "ide_smart", ideUuid: "synthetic-ide" });
      await ctx.db.insert("groupMembers", { projectId: f.projectId, groupId: f.ruleId, employeeId: f.visitorId, createdAt: "" });
      for (const deviceId of [hikId, ideId]) await ctx.db.insert("groupDevices", { projectId: f.projectId, groupId: f.ruleId, deviceId, createdAt: "" });
      const authId = await ctx.db.insert("employeeAuth", { employeeId: f.visitorId, projectId: f.projectId, createdAt: "", updatedAt: "" });
      const sessionId = await ctx.db.insert("employeeSessions", { employeeId: f.visitorId, token: "synthetic", expiresAt: "2099-01-01", createdAt: "" });
      const consentId = await ctx.db.insert("employeeConsents", { employeeId: f.visitorId, consentType: "visitor_kvkk", grantedAt: "" });
      const readingId = await ctx.db.insert("cardReadings", { projectId: f.projectId, employeeId: f.visitorId, cardNo: "56789", employeeName: "Visitor", accessTime: "2026-10-25T10:00:00Z" });
      return { hikId, ideId, authId, sessionId, consentId, readingId };
    });
    await f.caller.mutation(api.visitors.removeVisitor, { visitorId: f.visitorId });
    const state = await f.snapshot();
    expect(await f.t.run(ctx => ctx.db.get(f.visitorId))).toBeNull();
    expect(state.members).toHaveLength(0);
    expect(state.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "actions/hikvisionSync:deleteEmployeeFromDevicesInternal", args: [{ employeeId: f.visitorId, snapshot: expect.objectContaining({ cardNumber: "56789", projectId: f.projectId, devices: [expect.objectContaining({ _id: ids.hikId })] }) }] }),
      expect.objectContaining({ name: "actions/ideGatewayDevice:deleteIdeUserFromPanels", args: [{ employeeId: f.visitorId, cardNumber: "56789", deviceIds: [ids.ideId], projectId: f.projectId }] }),
    ]));
    expect(await f.t.run(ctx => ctx.db.get(ids.authId))).toBeNull();
    expect(await f.t.run(ctx => ctx.db.get(ids.sessionId))).toBeNull();
    expect((await f.t.run(ctx => ctx.db.get(ids.consentId)))?.revokedAt).toBeDefined();
    expect(await f.t.run(ctx => ctx.db.get(ids.readingId))).toMatchObject({ employeeName: "[silindi]", cardNo: expect.not.stringMatching(/^56789$/) });
    expect(state.audit).toEqual(expect.arrayContaining([expect.objectContaining({ userId: f.userId, projectId: f.projectId, action: "delete", targetId: f.visitorId })]));
  });

  it.each(["hr", "viewer"] as const)("%s cannot delete a visitor", async role => {
    const f = await fixture(role);
    const before = await f.snapshot();
    await expect(f.caller.mutation(api.visitors.removeVisitor, { visitorId: f.visitorId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(await f.snapshot()).toEqual(before);
  });

  it("security cannot delete an employee or a visitor from another project", async () => {
    const f = await fixture("security");
    const before = await f.snapshot();
    await expect(f.caller.mutation(api.visitors.removeVisitor, { visitorId: f.employeeId })).rejects.toThrow("Ziyaretçi bulunamadı");
    await expect(f.caller.mutation(api.visitors.removeVisitor, { visitorId: f.otherVisitorId })).rejects.toThrow("yetkiniz yok");
    expect(await f.snapshot()).toEqual(before);
  });
});
