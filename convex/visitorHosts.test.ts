// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import type { VisitorHostOption } from "./visitorHosts";

const modules = import.meta.glob("./**/*.ts");
const search = makeFunctionReference<"query", { projectId: Id<"projects">; search: string }, VisitorHostOption[]>("visitorHosts:search");
async function fixture(role: "security" | "technician" = "security") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Visitors" });
    const foreignProjectId = await ctx.db.insert("projects", { name: "Foreign" });
    const userId = await ctx.db.insert("users", { role: "project_user", verified: true });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId, role });
    const common = { projectId, email: "host@example.test", cardNumber: "1", isActive: true };
    const hostId = await ctx.db.insert("employees", { ...common, firstName: "Deniz", lastName: "Yılmaz" });
    const inactiveId = await ctx.db.insert("employees", { ...common, firstName: "Ece", lastName: "Kaya", isActive: false, isVisitor: false });
    await ctx.db.insert("employees", { ...common, firstName: "Deniz", lastName: "Visitor", isVisitor: true });
    await ctx.db.insert("employees", { ...common, projectId: foreignProjectId, firstName: "Deniz", lastName: "Foreign" });
    return { projectId, foreignProjectId, userId, sessionId, hostId, inactiveId };
  });
  return { ...ids, t, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
describe("bounded visitor host options", () => {
  it("searches first and last names, excludes visitors and other projects, and exposes only option fields", async () => {
    const f = await fixture();
    for (const term of ["Den", "Yıl", "Deniz Yıl"]) {
      const rows = await f.caller.query(search, { projectId: f.projectId, search: term });
      expect(rows).toEqual([{ _id: f.hostId, firstName: "Deniz", lastName: "Yılmaz", isActive: true }]);
    }
    const rows = await f.caller.query(search, { projectId: f.projectId, search: "" });
    expect(rows.map(row => row._id)).toEqual(expect.arrayContaining([f.hostId, f.inactiveId]));
    expect(rows).toHaveLength(2);
  });
  it("caps both empty and name searches at 50 and deduplicates matches", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let index = 0; index < 65; index++) {
        await ctx.db.insert("employees", { projectId: f.projectId, firstName: "Bulk", lastName: "Bulk", email: `bulk${index}@example.test`, cardNumber: `${index}`, isActive: true, isVisitor: false });
      }
    });
    for (const term of ["", "Bulk"]) {
      const rows = await f.caller.query(search, { projectId: f.projectId, search: term });
      expect(rows).toHaveLength(50);
      expect(new Set(rows.map(row => row._id)).size).toBe(50);
    }
  });
  it("requires authentication, project scope and visitor management permission", async () => {
    const f = await fixture("technician");
    await expect(f.t.query(search, { projectId: f.projectId, search: "" })).rejects.toThrow();
    await expect(f.caller.query(search, { projectId: f.projectId, search: "" })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.query(search, { projectId: f.foreignProjectId, search: "" })).rejects.toThrow("erişim yetkiniz yok");
  });
});
