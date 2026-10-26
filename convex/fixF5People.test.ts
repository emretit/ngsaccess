// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { findDuplicateEmployee, normalizeEmployeeEmail } from "./employees";
import { cascadeRemoveEmployeePII } from "./lib/employeeCascade";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    await ctx.db.insert("userProjects", { userId, projectId, role: "admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ali", lastName: "Test", email: "Ali@X.com ", cardNumber: "123", isActive: true });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Visitors", targetType: "visitor" });
    return { projectId, otherProjectId, userId, sessionId, employeeId, ruleId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}

describe("R-02 email identity", () => {
  it("normalizes empty and mixed-case addresses", () => {
    expect(normalizeEmployeeEmail(" Ali@X.com ")).toBe("ali@x.com");
    expect(normalizeEmployeeEmail("   ")).toBeUndefined();
  });
  it("normalizes create/update/auth writes and rejects duplicate normalized identities", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { email: "ali@x.com" }));
    const employeeId = await f.caller.mutation(api.employees.create, { projectId: f.projectId, firstName: "New", lastName: "Test", email: " New@X.com ", cardNumber: "234" });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.email).toBe("new@x.com");
    await expect(f.caller.mutation(api.employees.create, { projectId: f.projectId, firstName: "Dup", lastName: "Test", email: "ALI@X.COM", cardNumber: "345" })).rejects.toThrow("e-posta");
    await f.caller.mutation(api.employees.update, { employeeId, email: " Updated@X.COM " });
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.email).toBe("updated@x.com");
    const authId = await f.t.mutation(internal.employeeAuth.create, { employeeId, email: " Updated@X.COM " });
    expect((await f.t.run(ctx => ctx.db.get(authId)))?.email).toBe("updated@x.com");
    await f.t.mutation(internal.employeeAuth.update, { authId, email: " Next@X.COM " });
    expect((await f.t.run(ctx => ctx.db.get(authId)))?.email).toBe("next@x.com");
    await expect(f.caller.mutation(api.employees.update, { employeeId, email: " ALI@X.COM " })).rejects.toThrow("e-posta");
    await f.t.run(ctx => ctx.db.patch(employeeId, { projectId: f.otherProjectId }));
    await expect(f.caller.mutation(api.employees.update, { employeeId, email: "blocked@x.com" })).rejects.toThrow("yetkiniz yok");
  });
  it.each([
    ["ali@x.com", "ALI@x.com"],
    ["Ali@X.com", " Ali@X.com "],
  ])("allows mobile sign-in against stored %s with input %s", async (email, input) => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.employeeId, { email });
      await ctx.db.insert("employeeAuth", { employeeId: f.employeeId, email, passwordHash: bcrypt.hashSync("Password-2026", 4), createdAt: "", updatedAt: "" });
    });
    const result = await f.t.mutation(api.employeeAuth.signIn, { email: input, password: "Password-2026" });
    expect(result).toHaveProperty("token");
    expect((await f.t.run(ctx => ctx.db.query("employeeAuth").first()))?.email).toBe("ali@x.com");
    expect(await f.t.mutation(api.employeeAuth.signIn, { email: input, password: "wrong" })).toHaveProperty("error.code", "INVALID_CREDENTIALS");
  });
  it("checks duplicates only through normalized and trimmed raw by_email lookups", async () => {
    const id = "legacy" as Id<"employees">;
    const employee: Doc<"employees"> = { _id: id, _creationTime: 1, firstName: "Legacy", lastName: "Test", email: "Legacy@X.com", cardNumber: "1" };
    const lookups: string[] = [];
    const ctx = { db: { query: (table: string) => {
      expect(table).toBe("employees");
      return { withIndex: (index: string, apply: (q: { eq: (field: string, value: string) => void }) => void) => {
        expect(index).toBe("by_email");
        let candidate = "";
        apply({ eq: (field, value) => { expect(field).toBe("email"); candidate = value; lookups.push(value); } });
        return { async *[Symbol.asyncIterator]() { if (candidate === employee.email) yield employee; } };
      } };
    } } } as unknown as QueryCtx;
    expect(await findDuplicateEmployee(ctx, "email", " Legacy@X.com ")).toEqual(employee);
    expect(lookups.splice(0)).toEqual(["legacy@x.com", "Legacy@X.com"]);
    expect(await findDuplicateEmployee(ctx, "email", " Legacy@X.com ", id)).toBeNull();
    expect(lookups.splice(0)).toEqual(["legacy@x.com", "Legacy@X.com"]);
    expect(await findDuplicateEmployee(ctx, "email", "missing@x.com")).toBeNull();
    expect(lookups).toEqual(["missing@x.com"]);
  });
  it.each([
    ["Ali@x.com", "ali@x.com", 0],
    ["Ali@x.com", "ALI@x.com", 1],
  ])("checks global collisions for %s and %s", async (firstEmail, secondEmail, updated) => {
    const f = await fixture();
    const secondId = await f.t.run(async ctx => {
      await ctx.db.patch(f.employeeId, { email: firstEmail });
      return ctx.db.insert("employees", { projectId: f.otherProjectId, firstName: "Other", lastName: "Test", email: secondEmail, cardNumber: "other" });
    });
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await f.t.mutation(internal.migrations.normalizeEmployeeEmails, {})).toMatchObject({ updated, collisions: 1, isDone: true });
    expect((await f.t.run(ctx => ctx.db.get(f.employeeId)))?.email).toBe(updated ? "ali@x.com" : firstEmail);
    expect((await f.t.run(ctx => ctx.db.get(secondId)))?.email).toBe(secondEmail);
    expect(warnings).toHaveBeenCalledExactlyOnceWith("Employee email normalization collision", {
      employeeId: updated ? secondId : f.employeeId,
      conflictingEmployeeId: updated ? f.employeeId : secondId,
    });
  });
  it("stops scheduling after the twentieth batch and returns a resumable cursor", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 201; i++) await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Cap", lastName: "Test", email: `cap${i}@x.com`, cardNumber: `cap-${i}` });
    });
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await f.t.mutation(internal.migrations.normalizeEmployeeEmails, { round: 19 });
    expect(result).toMatchObject({ isDone: false, scheduled: false });
    expect(result.continueCursor).not.toBe("");
    const resumed = await f.t.mutation(internal.migrations.normalizeEmployeeEmails, { cursor: result.continueCursor });
    expect(resumed).toMatchObject({ isDone: true, scheduled: false });
  });
  it("normalizes 450 records in three batches and leaves existing normalized collisions unchanged", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.delete(f.employeeId);
      for (let i = 0; i < 450; i++) await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Batch", lastName: "Test", email: ` Batch${i}@X.COM `, cardNumber: `batch-${i}` });
      for (const email of [" CLASH@X.com ", "clash@x.com"]) await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Clash", lastName: "Test", email, cardNumber: email });
    });
    const logs = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = await f.t.mutation(internal.migrations.normalizeEmployeeEmails, {});
    expect(first).toMatchObject({ updated: 200, isDone: false, scheduled: true });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(logs).toHaveBeenCalledTimes(3);
    expect(logs.mock.calls[logs.mock.calls.length - 1]?.[1]).toMatchObject({ updated: 450, collisions: 1, isDone: true });
    expect(warnings).toHaveBeenCalledTimes(1);
    const rows = await f.t.run(ctx => ctx.db.query("employees").collect());
    expect(rows.filter(row => row.firstName === "Batch").every(row => row.email === normalizeEmployeeEmail(row.email))).toBe(true);
    expect(rows.filter(row => row.firstName === "Clash").map(row => row.email)).toEqual([" CLASH@X.com ", "clash@x.com"]);
    await expect(f.t.mutation(internal.migrations.normalizeEmployeeEmails, { round: 20 })).rejects.toThrow("0–19");
  });
});

describe("K-07 and Y-10 host lifecycle", () => {
  it("edits an orphaned visitor, but rejects explicit missing/foreign hosts and foreign-project edits", async () => {
    const f = await fixture();
    const visitorId = await f.t.run(async ctx => {
      const id = await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Visitor", lastName: "Test", email: "v@x.com", cardNumber: "V", isVisitor: true, isActive: false, accessRuleId: f.ruleId, hostEmployeeId: f.employeeId });
      await ctx.db.delete(f.employeeId);
      return id;
    });
    await f.caller.mutation(api.visitors.update, { visitorId, notes: "Updated" });
    expect(await f.t.run(ctx => ctx.db.get(visitorId))).toMatchObject({ notes: "Updated" });
    expect((await f.t.run(ctx => ctx.db.get(visitorId)))?.hostEmployeeId).toBeUndefined();
    await expect(f.caller.mutation(api.visitors.update, { visitorId, hostEmployeeId: f.employeeId })).rejects.toThrow();
    const foreign = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.otherProjectId, firstName: "Foreign", lastName: "Test", email: "", cardNumber: "foreign" }));
    await expect(f.caller.mutation(api.visitors.update, { visitorId, hostEmployeeId: foreign })).rejects.toThrow();
    await f.t.run(ctx => ctx.db.patch(visitorId, { projectId: f.otherProjectId }));
    await expect(f.caller.mutation(api.visitors.update, { visitorId, notes: "Denied" })).rejects.toThrow("yetkiniz yok");
  });
  it("runs host cleanup through authorized employee deletion and rejects viewer deletion", async () => {
    const f = await fixture();
    const visitorId = await f.t.run(ctx => ctx.db.insert("employees", { projectId: f.projectId, firstName: "Visitor", lastName: "Test", email: "contact@x.com", visitorPhone: "555", hostEmployeeId: f.employeeId, isVisitor: true, cardNumber: "v" }));
    const membership = await f.t.run(ctx => ctx.db.query("userProjects").first());
    if (!membership) throw new Error("Missing membership");
    await f.t.run(ctx => ctx.db.patch(membership._id, { role: "viewer" }));
    await expect(f.caller.mutation(api.employees.remove, { employeeId: f.employeeId })).rejects.toThrow("yetkiniz yok");
    expect((await f.t.run(ctx => ctx.db.get(visitorId)))?.email).toBe("contact@x.com");
    await f.t.run(ctx => ctx.db.patch(membership._id, { role: "admin" }));
    await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
    const visitor = await f.t.run(ctx => ctx.db.get(visitorId));
    expect(visitor).toMatchObject({ firstName: "Visitor", email: "" });
    expect(visitor?.hostEmployeeId).toBeUndefined();
    expect(visitor?.visitorPhone).toBeUndefined();
  });
  it("clears contact fields and host links for 450 visitors in batches, retaining profiles and history", async () => {
    vi.useFakeTimers();
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 450; i++) await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Visitor", lastName: "Test", email: `v${i}@x.com`, visitorPhone: "555", visitorCompany: "Keep", notes: "Keep", hostEmployeeId: f.employeeId, isVisitor: true, cardNumber: `v-${i}` });
      await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Unrelated", lastName: "Test", email: "keep@x.com", visitorPhone: "Keep", isVisitor: true, cardNumber: "unrelated" });
      const user = await ctx.db.get(f.userId);
      if (!user) throw new Error("Missing user");
      await cascadeRemoveEmployeePII({ ...ctx, user }, f.employeeId);
      await ctx.db.delete(f.employeeId);
    });
    const read = () => f.t.run(ctx => ctx.db.query("employees").collect());
    expect((await read()).filter(row => row.email === "")).toHaveLength(200);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const rows = await read();
    expect(rows).toHaveLength(451);
    expect(rows.filter(row => row.firstName === "Visitor").every(row => row.email === "" && !row.visitorPhone && !row.hostEmployeeId && row.visitorCompany === "Keep" && row.notes === "Keep")).toBe(true);
    expect(rows.find(row => row.firstName === "Unrelated")).toMatchObject({ email: "keep@x.com", visitorPhone: "Keep" });
  });
});
