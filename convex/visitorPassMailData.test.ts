// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { hashVisitorSecret } from "./lib/visitorPass";
const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
    const visitorId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Visitor", email: "ada@example.test", cardNumber: "123456", isVisitor: true, visitorCredential: "pass", isActive: true,
      accessStartsAt: new Date(Date.now() - 1000).toISOString(), accessExpiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    return { projectId, userId, sessionId, visitorId };
  });
  const admin = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const issued = await admin.mutation(api.visitorPasses.issue, { visitorId: ids.visitorId });
  const args = { visitorId: ids.visitorId, tokenHash: await hashVisitorSecret(issued.token), pinHash: await hashVisitorSecret(`${ids.projectId}:${issued.pin}`) };
  return { t, admin, issued, args, ...ids };
}
describe("visitor email authorization and credential matching", () => {
  it.each(["", "   ", "ziyaretci-test@ngsaccess.local", "ZIYARETCI-test@NGSACCESS.LOCAL", " ziyaretci-test@NgSAccess.Local "])("rejects missing or synthetic recipient %j before delivery", async email => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { email }));
    const auditsBefore = await f.t.run(ctx => ctx.db.query("auditLog").take(10));
    expect(await f.admin.query(internal.visitorPassMailData.prepare, f.args)).toEqual({ ok: false, reason: "NO_EMAIL" });
    expect(await f.t.run(ctx => ctx.db.query("auditLog").take(10))).toEqual(auditsBefore);
  });
  it("keeps a real recipient after trimming and does not reject similar external domains", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { email: " ada@ngsaccess.local.example.test " }));
    expect(await f.admin.query(internal.visitorPassMailData.prepare, f.args)).toMatchObject({ ok: true, email: "ada@ngsaccess.local.example.test" });
  });
  it("requires visitors.manage and the live auth session, including internal preparation", async () => {
    const f = await fixture();
    await expect(f.t.query(internal.visitorPassMailData.prepare, f.args)).rejects.toThrow();
    const viewer = await f.t.run(async ctx => {
      const userId = await ctx.db.insert("users", { role: "project_user" });
      const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
      await ctx.db.insert("userProjects", { userId, projectId: f.projectId, role: "viewer" });
      return { userId, sessionId };
    });
    await expect(f.t.withIdentity({ subject: `${viewer.userId}|${viewer.sessionId}` }).query(internal.visitorPassMailData.prepare, f.args)).rejects.toThrow();
    await f.t.run(ctx => ctx.db.delete(f.sessionId));
    await expect(f.admin.query(internal.visitorPassMailData.prepare, f.args)).rejects.toThrow();
  });
  it.each(["token", "pin", "revoked", "exhausted", "rotated", "inactive"] as const)("rejects %s mismatch or unavailable pass", async kind => {
    const f = await fixture();
    if (kind === "token") f.args.tokenHash = "wrong";
    if (kind === "pin") f.args.pinHash = "wrong";
    if (kind === "rotated") await f.admin.mutation(api.visitorPasses.regenerate, { visitorId: f.visitorId });
    await f.t.run(async ctx => {
      if (kind === "revoked" || kind === "exhausted") await ctx.db.patch(f.issued.passId, { status: kind });
      if (kind === "inactive") await ctx.db.patch(f.visitorId, { isActive: false });
    });
    expect(await f.admin.query(internal.visitorPassMailData.prepare, f.args)).toEqual({ ok: false, reason: "PASS_MISMATCH" });
  });
  it("uses stored recipient and metadata, rejects no email, and audits no credentials", async () => {
    const f = await fixture();
    expect(await f.admin.query(internal.visitorPassMailData.prepare, f.args)).toMatchObject({ ok: true, email: "ada@example.test", name: "Ada Visitor", projectId: f.projectId });
    await f.admin.mutation(internal.visitorPassMailData.recordSent, { visitorId: f.visitorId, passId: f.issued.passId });
    const audits = await f.t.run(ctx => ctx.db.query("auditLog").take(10));
    expect(audits[audits.length - 1]?.note).toBe("pass e-postası gönderildi");
    expect(JSON.stringify(audits)).not.toContain(f.issued.token); expect(JSON.stringify(audits)).not.toContain(f.issued.pin);
    await f.t.run(ctx => ctx.db.patch(f.visitorId, { email: " " }));
    expect(await f.admin.query(internal.visitorPassMailData.prepare, f.args)).toEqual({ ok: false, reason: "NO_EMAIL" });
  });
});
