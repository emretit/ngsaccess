// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { claimEmployeePhoto } from "./lib/peoplePhoto";

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
    const storageId = await f.caller.action(api.files.upload, { bytes: jpeg(), mimeType: "image/jpeg" });
    await f.caller.mutation(api.files.claimUpload, { storageId });
    await f.t.run(async ctx => {
      const pending = await ctx.db.query("pendingUploads").unique();
      if (!pending) throw new Error("pending yok");
      await ctx.db.patch(pending._id, { createdAt: Date.now() - 25 * 3600000 });
    });
    await f.t.mutation(internal.files.cleanupPendingUploads, {});
    expect(await f.t.run(async ctx => (await ctx.storage.get(storageId)) === null)).toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(0);
  });
});

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
describe("SEC-209 server-recorded upload ownership", () => {
  it("cannot claim an unregistered blob just by knowing its ID", async () => {
    const f = await fixture();
    for (const fn of [api.files.claimUpload, api.files.getUploadUrl, api.files.saveUserPhoto]) {
      await expect(f.caller.mutation(fn, { storageId: f.storageId })).rejects.toThrow("yalnız yükleyen");
    }
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toEqual([]);
  });
  it("another user cannot claim/read/save the uploader's blob, including after profile consumption", async () => {
    const f = await fixture();
    const otherSessionId = await f.t.run(ctx => ctx.db.insert("authSessions", { userId: f.otherUserId, expirationTime: Date.now() + 86400000 }));
    const other = f.t.withIdentity({ subject: `${f.otherUserId}|${otherSessionId}` });
    const storageId = await f.caller.action(api.files.upload, { bytes: jpeg(), mimeType: "image/jpeg" });
    for (const fn of [api.files.claimUpload, api.files.getUploadUrl, api.files.saveUserPhoto]) {
      await expect(other.mutation(fn, { storageId })).rejects.toThrow("yalnız yükleyen");
    }
    await f.caller.mutation(api.files.claimUpload, { storageId });
    await setMetadata(f, storageId, "image/jpeg");
    const url = await f.caller.mutation(api.files.getUploadUrl, { storageId });
    expect(await f.caller.mutation(api.files.saveUserPhoto, { storageId })).toBe(url);
    expect((await f.t.run(ctx => ctx.db.get(f.userId)))?.photoUrl).toBe(url);
    await expect(other.mutation(api.files.claimUpload, { storageId })).rejects.toThrow("yalnız yükleyen");
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toEqual([]);
  });
  it.each([
    { bytes: new ArrayBuffer(0), mimeType: "image/jpeg" },
    { bytes: new ArrayBuffer(5 * 1024 * 1024 + 1), mimeType: "image/jpeg" },
    { bytes: jpeg(), mimeType: "application/pdf" },
    { bytes: new TextEncoder().encode("%PDF-1.7").buffer, mimeType: "application/pdf" },
    { bytes: new TextEncoder().encode("fake").buffer, mimeType: "image/jpeg" },
    { bytes: jpeg(), mimeType: "text/html" },
  ])("rejects invalid content/size/MIME before recording ownership: $mimeType", async args => {
    const f = await fixture();
    await expect(f.caller.action(api.files.upload, args)).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toEqual([]);
  });
  it.each([
    { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer, mimeType: "image/png" },
    { bytes: new TextEncoder().encode("RIFF0000WEBP").buffer, mimeType: "image/webp" },
  ])("accepts supported image signature: $mimeType", async args => {
    const f = await fixture();
    const storageId = await f.caller.action(api.files.upload, args);
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").unique())).toMatchObject({ userId: f.userId, storageId });
  });
});

it("server upload can be consumed by the employee photo update", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Photo project" });
    await ctx.db.patch(f.userId, { verified: true });
    await ctx.db.insert("userProjects", { userId: f.userId, projectId, role: "hr" });
    await ctx.db.patch(f.employeeId, { projectId });
  });
  const storageId = await f.caller.action(api.files.upload, { bytes: jpeg(), mimeType: "image/jpeg" });
  await setMetadata(f, storageId, "image/jpeg");
  await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, photoStorageId: storageId });
  expect(await f.t.run(ctx => ctx.db.get(f.employeeId))).toMatchObject({ photoStorageId: storageId });
  expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toEqual([]);
});

it("accepts the 5 MiB upload boundary", async () => {
  const f = await fixture();
  const bytes = new Uint8Array(5 * 1024 * 1024);
  bytes.set(new Uint8Array(jpeg()));
  const storageId = await f.caller.action(api.files.upload, { bytes: bytes.buffer, mimeType: "image/jpeg" });
  expect(await f.t.run(ctx => ctx.db.system.get(storageId))).toMatchObject({ size: bytes.byteLength });
});

// convex-test storeBlob omits contentType; seed the system fixture
// explicitly to match real Convex storage metadata (never used in app code).
async function setMetadata(f: Awaited<ReturnType<typeof fixture>>, storageId: Id<"_storage">, contentType: string) {
  await f.t.run(ctx => Reflect.apply(ctx.db.patch, ctx.db, [storageId, { contentType }]));
}

it.each(["face", "attachment", "employee", "user"] as const)("cleanup preserves a legacy pending blob referenced by %s", async kind => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Reference" });
    if (kind === "face") await ctx.db.insert("employeeFaces", { employeeId: f.employeeId, projectId, pictureStorageId: f.storageId, addedAt: Date.now() });
    if (kind === "attachment") {
      const sessionId = await ctx.db.insert("employeeSessions", { employeeId: f.employeeId, token: "attachment-session", createdAt: "now", expiresAt: "2099-01-01" });
      await ctx.db.insert("requestAttachments", { employeeId: f.employeeId, projectId, sessionId, storageId: f.storageId, name: "document.pdf", contentType: "application/pdf", size: 4 });
    }
    if (kind === "employee") await ctx.db.patch(f.employeeId, { photoStorageId: f.storageId });
    if (kind === "user") {
      const photoUrl = await ctx.storage.getUrl(f.storageId);
      if (!photoUrl) throw new Error("No URL");
      await ctx.db.patch(f.otherUserId, { photoUrl });
    }
    await ctx.db.insert("pendingUploads", { storageId: f.storageId, userId: f.userId, createdAt: Date.now() - 25 * 3600000 });
  });
  await f.t.mutation(internal.files.cleanupPendingUploads, {});
  expect(await f.t.run(async ctx => (await ctx.storage.get(f.storageId)) !== null)).toBe(true);
  expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toEqual([]);
});

it("allows 20 recent pending uploads per user, excluding old and other-user rows", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 19; i++) await ctx.db.insert("pendingUploads", { storageId: f.storageId, userId: f.userId, createdAt: Date.now() });
    for (let i = 0; i < 25; i++) {
      await ctx.db.insert("pendingUploads", { storageId: f.storageId, userId: f.userId, createdAt: Date.now() - 25 * 3600000 });
      await ctx.db.insert("pendingUploads", { storageId: f.storageId, userId: f.otherUserId, createdAt: Date.now() });
    }
  });
  await f.caller.action(api.files.upload, { bytes: jpeg(), mimeType: "image/jpeg" });
  const storedBefore = await f.t.run(ctx => ctx.db.system.query("_storage").collect());
  await expect(f.caller.action(api.files.upload, { bytes: jpeg(), mimeType: "image/jpeg" })).rejects.toThrow("20 bekleyen");
  expect(await f.t.run(ctx => ctx.db.system.query("_storage").collect())).toEqual(storedBefore);
  const recent = await f.t.run(ctx => ctx.db.query("pendingUploads").withIndex("by_user", q => q.eq("userId", f.userId).gte("createdAt", Date.now() - 86400000)).collect());
  expect(recent).toHaveLength(20);
});

it.each(["application/pdf", "text/html", "image/gif", "image/svg+xml", undefined])("photo consumers reject metadata MIME %s without consuming ownership", async contentType => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.insert("pendingUploads", { storageId: f.storageId, userId: f.userId, createdAt: Date.now() }));
  if (contentType) await setMetadata(f, f.storageId, contentType);
  await expect(f.caller.mutation(api.files.saveUserPhoto, { storageId: f.storageId })).rejects.toThrow("JPEG, PNG veya WebP");
  await expect(f.t.run(ctx => claimEmployeePhoto(ctx, f.storageId, f.userId))).rejects.toThrow("JPEG, PNG veya WebP");
  expect((await f.t.run(ctx => ctx.db.query("pendingUploads").collect()))).toHaveLength(1);
  expect((await f.t.run(ctx => ctx.db.get(f.userId)))?.photoUrl).toBeUndefined();
});

it.each(["image/jpeg", "image/png", "image/webp"])("photo consumers accept metadata MIME %s", async contentType => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.insert("pendingUploads", { storageId: f.storageId, userId: f.userId, createdAt: Date.now() }));
  await setMetadata(f, f.storageId, contentType);
  expect(await f.t.run(ctx => claimEmployeePhoto(ctx, f.storageId, f.userId))).toMatchObject({ photoStorageId: f.storageId });
  await f.t.run(ctx => ctx.db.insert("pendingUploads", { storageId: f.storageId, userId: f.userId, createdAt: Date.now() }));
  expect(await f.caller.mutation(api.files.saveUserPhoto, { storageId: f.storageId })).toBeTruthy();
  expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toEqual([]);
});
