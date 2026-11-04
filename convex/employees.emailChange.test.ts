// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Test" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "ada@test.example", cardNumber: "123", isActive: true });
    const now = new Date().toISOString();
    const authId = await ctx.db.insert("employeeAuth", {
      employeeId, projectId, email: "ada@test.example", setupToken: "old-link",
      tokenExpiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: now, updatedAt: now,
    });
    return { employeeId, authId, userId, sessionId };
  });
  return { t, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), ...ids };
}

it.each([["", undefined], ["yeni@test.example", "yeni@test.example"]])("P01: e-posta %j olunca eski kurulum bağlantısı geçersiz", async (email, authEmail) => {
  const f = await fixture();
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, email });
  const auth = await f.t.run(ctx => ctx.db.get(f.authId));
  expect([auth?.email, auth?.setupToken, auth?.tokenExpiresAt]).toEqual([authEmail, undefined, undefined]);
  expect(await f.t.mutation(internal.employeeAuth.consumeSetupToken, { token: "old-link", passwordHash: "x" })).toEqual({ status: "invalid" });
});

it("P01: e-posta aynı kalırsa (büyük harf/boşluk dahil) bağlantı korunur", async () => {
  const f = await fixture();
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, email: " ADA@test.example ", firstName: "Ayşe" });
  expect((await f.t.run(ctx => ctx.db.get(f.authId)))?.setupToken).toBe("old-link");
});
