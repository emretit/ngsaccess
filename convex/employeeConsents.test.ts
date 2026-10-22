// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { makeFunctionReference } from "convex/server";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
async function fixture(role: "project_admin" | "project_user" | "super_admin" = "project_admin", enabled = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role });
    const otherUserId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("projectPrivacySettings", { projectId, biometricEnabled: enabled, updatedAt: "now" });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "test@test", cardNumber: "123", isActive: true });
    const otherEmployeeId = await ctx.db.insert("employees", { projectId: otherProjectId, firstName: "B", lastName: "Test", email: "b@test", cardNumber: "456", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", isActive: true, createdAt: "now", updatedAt: "now" });
    return { projectId, userId, otherUserId, sessionId, employeeId, otherEmployeeId, deviceId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }) };
}
async function document(f: Awaited<ReturnType<typeof fixture>>, type = "application/pdf", size = 4, own = true, pending = true) {
  return f.t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(size)], { type }));
    // convex-test storeBlob omits contentType; emulate HTTP upload metadata.
    const testDb = ctx.db as unknown as { patch: (id: Id<"_storage">, value: { contentType: string }) => Promise<void> };
    await testDb.patch(storageId, { contentType: type });
    if (pending) await ctx.db.insert("pendingUploads", { storageId, userId: own ? f.userId : f.otherUserId, createdAt: Date.now() });
    return storageId;
  });
}

describe("KVKK rızaları", () => {
  it.each(["project_admin", "super_admin"] as const)("%s rıza verir, listeler, iptal eder ve audit yazar", async role => {
    const f = await fixture(role);
    const id = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo" });
    expect(await f.caller.query(api.employeeConsents.listForEmployee, { employeeId: f.employeeId })).toHaveLength(1);
    await f.caller.mutation(api.employeeConsents.revoke, { id });
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ revokedAt: expect.any(String) });
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(2);
  });
  it.each(["biometric_face", "biometric_fingerprint"] as const)("%s iptalinde yalnız parmak izi purge planlar, tekrarlı iptal etkisizdir", async consentType => {
    const f = await fixture();
    const id = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType });
    const enrollmentId = await f.t.run(ctx => ctx.db.insert("deviceFingerprintEnrollments", { employeeId: f.employeeId, deviceId: f.deviceId, fingerNo: 2, enrolledAt: "now", enrolledBy: f.userId }));
    await f.caller.mutation(api.employeeConsents.revoke, { id });
    const row = await f.t.run(ctx => ctx.db.get(enrollmentId));
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    if (consentType === "biometric_fingerprint") {
      expect(row).toMatchObject({ cancelRequested: true, deletionEmployeeNo: "123" });
      expect(jobs).toHaveLength(1);
      const audits = await f.t.run(ctx => ctx.db.query("auditLog").collect());
      expect(audits.some(a => a.note?.includes("cihaz parmak izleri silme kuyruğuna alındı (1)"))).toBe(true);
    } else {
      expect(row?.cancelRequested).toBeUndefined();
      expect(jobs).toHaveLength(0);
    }
    await f.caller.mutation(api.employeeConsents.revoke, { id });
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(jobs.length);
  });
  it("card grant validator tarafından reddedilir, eski kart rızası iptal edilir", async () => {
    const f = await fixture();
    await expect(f.caller.mutation(makeFunctionReference<"mutation">("employeeConsents:grant"), { employeeId: f.employeeId, consentType: "card" })).rejects.toThrow();
    const id = await f.t.run(ctx => ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType: "card", grantedAt: "now" }));
    await f.caller.mutation(api.employeeConsents.revoke, { id });
    expect((await f.t.run(ctx => ctx.db.get(id)))?.revokedAt).toBeDefined();
  });
  it.each(["application/pdf", "image/jpeg", "image/png"])("%s belge sahipliği tüketilir ve imzalı URL döner, iptalde dosya korunur", async type => {
    const f = await fixture();
    const storageId = await document(f, type);
    const id = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId });
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.get(id))).toMatchObject({ documentStorageId: storageId });
    expect(await f.caller.query(api.employeeConsents.getDocumentUrl, { id })).toMatch(/^https?:/);
    await f.caller.mutation(api.employeeConsents.revoke, { id });
    expect(await f.caller.query(api.employeeConsents.getDocumentUrl, { id })).toMatch(/^https?:/);
    expect(await f.t.run(async ctx => (await ctx.storage.get(storageId)) !== null)).toBe(true);
  });
  it.each([
    { type: "text/plain", size: 1, own: true, pending: true },
    { type: "application/pdf", size: 10 * 1024 * 1024 + 1, own: true, pending: true },
    { type: "application/pdf", size: 1, own: false, pending: true },
    { type: "application/pdf", size: 1, own: true, pending: false },
  ])("geçersiz belge reddedilir: %j", async ({ type, size, own, pending }) => {
    const f = await fixture();
    const storageId = await document(f, type, size, own, pending);
    await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("employeeConsents").collect())).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(pending ? 1 : 0);
  });
  it("project_user listeleyebilir, grant/revoke/belge URL alamaz", async () => {
    const f = await fixture("project_user");
    const id = await f.t.run(ctx => ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType: "photo", grantedAt: "now" }));
    expect(await f.caller.query(api.employeeConsents.listForEmployee, { employeeId: f.employeeId })).toHaveLength(1);
    await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo" })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.mutation(api.employeeConsents.revoke, { id })).rejects.toThrow("yetkiniz yok");
    await expect(f.caller.query(api.employeeConsents.getDocumentUrl, { id })).rejects.toThrow("yetkiniz yok");
  });
  it("başka proje rızası ve belgesi erişilemez, belgesiz rıza null döner", async () => {
    const f = await fixture();
    const id = await f.t.run(ctx => ctx.db.insert("employeeConsents", { employeeId: f.otherEmployeeId, consentType: "photo", grantedAt: "now" }));
    await expect(f.caller.query(api.employeeConsents.getDocumentUrl, { id })).rejects.toThrow("erişim yetkiniz yok");
    await expect(f.caller.mutation(api.employeeConsents.revoke, { id })).rejects.toThrow("erişim yetkiniz yok");
    await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.otherEmployeeId, consentType: "photo" })).rejects.toThrow("erişim yetkiniz yok");
    const ownId = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo" });
    expect(await f.caller.query(api.employeeConsents.getDocumentUrl, { id: ownId })).toBeNull();
  });
  it.each(["biometric_face", "biometric_fingerprint"] as const)("kapalı modülde %s grant yasak, iptal serbest", async consentType => {
    const f = await fixture("project_admin", false);
    await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType })).rejects.toThrow("biyometri modülü kapalı");
    const id = await f.t.run(ctx => ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType, grantedAt: "now" }));
    await f.caller.mutation(api.employeeConsents.revoke, { id });
    expect((await f.t.run(ctx => ctx.db.get(id)))?.revokedAt).toBeDefined();
  });
});

it.each(["project_admin", "super_admin"] as const)("%s için orphan çalışan erişimi korunur", async role => {
  const f = await fixture(role);
  await f.t.run(ctx => ctx.db.patch(f.employeeId, { projectId: undefined }));
  const grant = f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo" });
  if (role === "project_admin") await expect(grant).rejects.toThrow("erişim yetkiniz yok");
  else {
    const id = await grant;
    await f.caller.mutation(api.employeeConsents.revoke, { id });
    expect((await f.t.run(ctx => ctx.db.get(id)))?.revokedAt).toBeDefined();
  }
});
it("üyeliği kaldırılan yönetici ve oturumsuz kullanıcı belgeye erişemez", async () => {
  const f = await fixture();
  const storageId = await document(f);
  const id = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId });
  await f.t.run(async ctx => {
    for (const membership of await ctx.db.query("userProjects").collect()) await ctx.db.delete(membership._id);
  });
  await expect(f.caller.query(api.employeeConsents.getDocumentUrl, { id })).rejects.toThrow("erişim yetkiniz yok");
  await expect(f.t.query(api.employeeConsents.getDocumentUrl, { id })).rejects.toThrow("Giriş yapmanız gerekiyor");
});
it("10 MB belge sınırı dahildir", async () => {
  const f = await fixture();
  const storageId = await document(f, "application/pdf", 10 * 1024 * 1024);
  const id = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId });
  expect((await f.t.run(ctx => ctx.db.get(id)))?.documentStorageId).toBe(storageId);
});

 it("aktif belgesiz rızaya belge eklenir, aynı kayıt ve geçmiş korunur, audit yazılır", async () => {
  const f = await fixture();
  const id = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", notes: "ilk not" });
  const before = await f.t.run(ctx => ctx.db.get(id));
  const storageId = await document(f);
  expect(await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId, notes: "değişmesin" })).toBe(id);
  expect(await f.t.run(ctx => ctx.db.get(id))).toEqual({ ...before, documentStorageId: storageId });
  expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(0);
  expect(await f.t.run(ctx => ctx.db.query("employeeConsents").collect())).toHaveLength(1);
  expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toEqual(expect.arrayContaining([expect.objectContaining({ action: "update", targetId: id, newValue: expect.anything(), note: "KVKK rıza belgesi eklendi: photo" })]));
});
it.each(["storage", "legacy"])("aktif rızada %s belge varsa yeni belge reddedilir ve pending korunur", async kind => {
  const f = await fixture();
  const oldStorage = await document(f);
  const id = await f.t.run(ctx => ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType: "photo", grantedAt: "now", ...(kind === "storage" ? { documentStorageId: oldStorage } : { documentUrl: "https://example.test/form.pdf" }) }));
  const storageId = await document(f);
  await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId })).rejects.toThrow("Bu rıza için zaten belge var");
  expect((await f.t.run(ctx => ctx.db.get(id)))?.documentStorageId).toBe(kind === "storage" ? oldStorage : undefined);
  expect(await f.t.run(ctx => ctx.db.query("pendingUploads").withIndex("by_storage", q => q.eq("storageId", storageId)).unique())).not.toBeNull();
});
it.each([false, true])("başka rızaya bağlı belge yeni/mevcut rızada tekrar kullanılamaz (existing=%s)", async existing => {
  const f = await fixture();
  const storageId = await document(f);
  await f.t.run(async ctx => {
    await ctx.db.insert("employeeConsents", { employeeId: f.otherEmployeeId, consentType: "photo", grantedAt: "now", revokedAt: "later", documentStorageId: storageId });
    if (existing) await ctx.db.insert("employeeConsents", { employeeId: f.employeeId, consentType: "photo", grantedAt: "now" });
  });
  await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId })).rejects.toThrow("Dosya zaten bir rızaya bağlı");
  expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(1);
});
it.each([
  { type: "text/plain", own: true, pending: true, size: 1 },
  { type: "application/pdf", own: false, pending: true, size: 1 },
  { type: "application/pdf", own: true, pending: false, size: 1 },
  { type: "application/pdf", own: true, pending: true, size: 10 * 1024 * 1024 + 1 },
])("aktif belgesiz rızaya eklemede de doğrulama zorunlu: %j", async ({ type, own, pending, size }) => {
  const f = await fixture();
  const id = await f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo" });
  const storageId = await document(f, type, size, own, pending);
  await expect(f.caller.mutation(api.employeeConsents.grant, { employeeId: f.employeeId, consentType: "photo", documentStorageId: storageId })).rejects.toThrow();
  expect((await f.t.run(ctx => ctx.db.get(id)))?.documentStorageId).toBeUndefined();
  expect(await f.t.run(ctx => ctx.db.query("pendingUploads").collect())).toHaveLength(pending ? 1 : 0);
});
