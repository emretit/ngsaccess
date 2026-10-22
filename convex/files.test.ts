// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const otherUserId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    const employeeId = await ctx.db.insert("employees", { firstName: "Ada", lastName: "Test", email: "a@test", cardNumber: "123" });
    const storageId = await ctx.storage.store(new Blob(["form"], { type: "application/pdf" }));
    return { userId, otherUserId, sessionId, employeeId, storageId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
describe("rıza belgeleri upload yaşam döngüsü", () => {
  it.each([false, true])("bağlı belge yeniden claim edilemez (revoked=%s)", async revoked => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType: "photo", grantedAt: "now", revokedAt: revoked ? "later" : undefined, documentStorageId: f.storageId }));
    await expect(f.caller.mutation(api.files.claimUpload, { storageId: f.storageId })).rejects.toThrow("Dosya zaten bir rızaya bağlı");
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(0);
  });
  it("mevcut pending satırı bağlı belgeyi claim kontrolünden kaçırmaz", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType: "photo", grantedAt: "now", documentStorageId: f.storageId });
      await ctx.db.insert("pendingUploads", { userId: f.userId, storageId: f.storageId, createdAt: Date.now() });
    });
    await expect(f.caller.mutation(api.files.claimUpload, { storageId: f.storageId })).rejects.toThrow("Dosya zaten bir rızaya bağlı");
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(1);
  });
  it.each([false, true])("cleanup bağlı dosyayı korur, yalnız stale pending silinir (revoked=%s)", async revoked => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType: "photo", grantedAt: "now", revokedAt: revoked ? "later" : undefined, documentStorageId: f.storageId });
      await ctx.db.insert("pendingUploads", { userId: f.otherUserId, storageId: f.storageId, createdAt: Date.now() - 25 * 3600000 });
    });
    await f.t.mutation(internal.files.cleanupPendingUploads, {});
    expect(await f.t.run(async ctx => (await ctx.storage.get(f.storageId)) !== null)).toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.query("employeeConsents").collect())).toHaveLength(1);
  });
  it("bağsız upload claim edilir ve zamanı dolunca dosya da silinir", async () => {
    const f = await fixture();
    await f.caller.mutation(api.files.claimUpload, { storageId: f.storageId });
    await f.t.run(async ctx => {
      const pending = await ctx.db.query("pendingUploads").unique();
      if (!pending) throw new Error("pending yok");
      await ctx.db.patch(pending._id, { createdAt: Date.now() - 25 * 3600000 });
    });
    await f.t.mutation(internal.files.cleanupPendingUploads, {});
    expect(await f.t.run(async ctx => (await ctx.storage.get(f.storageId)) === null)).toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(0);
  });
});
