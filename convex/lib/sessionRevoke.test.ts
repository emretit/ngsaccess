// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../schema";
import { revokeUserSessions } from "./sessionRevoke";
const modules = import.meta.glob("../**/*.ts");

it("a delayed revoke preserves sessions newer than the captured creation boundary", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const userId = await ctx.db.insert("users", {});
    const old = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100000 });
    const oldSession = await ctx.db.get(old);
    if (!oldSession) throw new Error("Missing session");
    const fresh = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 100000 });
    await revokeUserSessions(ctx, userId, oldSession._creationTime);
    expect(await ctx.db.get(old)).toBeNull();
    expect(await ctx.db.get(fresh)).not.toBeNull();
  });
});
