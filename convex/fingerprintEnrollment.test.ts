// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import * as functions from "./fingerprintEnrollment";

const modules = import.meta.glob("./**/*.ts");
async function fixture(role: "project_admin" | "project_user" = "project_admin") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "A" });
    const otherProjectId = await ctx.db.insert("projects", { name: "B" });
    const userId = await ctx.db.insert("users", { role });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("projectPrivacySettings", { projectId, biometricEnabled: true, updatedAt: new Date().toISOString() });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "test@test", cardNumber: "123", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "dev", isActive: true, createdAt: "now", updatedAt: "now" });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Rule", isActive: true });
    const membershipId = await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId, createdAt: "now" });
    await ctx.db.insert("groupDevices", { projectId, groupId: ruleId, deviceId, createdAt: "now" });
    const consentId = await ctx.db.insert("employeeConsents", { employeeId, consentType: "biometric_fingerprint", grantedAt: "now" });
    return { projectId, otherProjectId, userId, sessionId, employeeId, deviceId, membershipId, consentId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), target: { employeeId: ids.employeeId, deviceId: ids.deviceId, fingerNo: 2 } };
}

describe("cihazda parmak izi metadata ve izinler", () => {
  it("tüm kayıtlı query/mutation dönüş validatorları açıkça tanımlıdır", () => {
    const registered = Object.values(functions).filter((value): value is typeof value & { exportReturns: () => string } => typeof value === "function" && "exportReturns" in value);
    expect(registered).toHaveLength(11);
    for (const fn of registered) expect(JSON.parse(fn.exportReturns())).not.toBeNull();
  });
  it("snapshot yokken denemeye izin verir, şablonsuz metadata yazar ve cihaz adı döner", async () => {
    const f = await fixture();
    const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    expect((await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).devices).toEqual([{ _id: f.deviceId, name: "Panel", capabilitiesScanned: false }]);
    await f.t.mutation(internal.fingerprintEnrollment.upsert, { ...f.target, attemptId, enrolledBy: f.userId, expectedCardNumber: "123" });
    const rows = await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").collect());
    expect(Object.keys(rows[0]).sort()).toEqual(["_creationTime", "_id", "deviceId", "employeeId", "enrolledAt", "enrolledBy", "fingerNo", "projectId"].sort());
    expect((await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).enrollments[0].deviceName).toBe("Panel");
  });
  it.each([false, true])("snapshot capture desteği %s ise kuralı uygular", async supported => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.deviceId, { hikCapabilitiesSnapshot: JSON.stringify({ probes: [{ key: "captureFingerprint", supported }] }) }));
    if (supported) await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target)).resolves.toBeTypeOf("string");
    else await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target)).rejects.toThrow("Bu cihaz parmak izi kaydını desteklemiyor");
  });
  it.each([0, 11, 1.5, NaN])("geçersiz parmak %s yazmadan reddedilir", async fingerNo => {
    const f = await fixture();
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, { ...f.target, fingerNo })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").collect())).toHaveLength(0);
  });
  it("oturumsuz ve project_user sorgu, başlatma ve iptal çağrıları reddedilir", async () => {
    const f = await fixture("project_user");
    await expect(f.t.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).rejects.toThrow("Giriş");
    await expect(f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).rejects.toThrow("yetkiniz");
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target)).rejects.toThrow("yetkiniz");
    await expect(f.caller.mutation(api.fingerprintEnrollment.cancelEnrollment, { ...f.target, attemptId: "unknown" })).rejects.toThrow("yetkiniz");
  });
  it.each(["consent", "module", "membership", "project", "transport", "inactive"])("%s şartı bozulursa kayıt engellenir", async condition => {
    const f = await fixture();
    await f.t.run(async ctx => {
      if (condition === "consent") await ctx.db.patch(f.consentId, { revokedAt: "now" });
      if (condition === "module") { const settings = await ctx.db.query("projectPrivacySettings").first(); if (settings) await ctx.db.patch(settings._id, { biometricEnabled: false }); }
      if (condition === "membership") await ctx.db.delete(f.membershipId);
      if (condition === "project") await ctx.db.patch(f.deviceId, { projectId: f.otherProjectId });
      if (condition === "transport") await ctx.db.patch(f.deviceId, { hikTransport: "localBridge" });
      if (condition === "inactive") await ctx.db.patch(f.employeeId, { isActive: false });
    });
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target)).rejects.toThrow();
    await expect(f.t.query(internal.fingerprintEnrollment.getTargetInternal, { employeeId: f.employeeId, deviceId: f.deviceId, userId: f.userId })).rejects.toThrow();
  });
  it("iptal sunucuda görünür, aynı cihazda paralel capture engellenir", async () => {
    const f = await fixture();
    const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, { ...f.target, fingerNo: 3 })).rejects.toThrow("başka bir");
    await f.caller.mutation(api.fingerprintEnrollment.cancelEnrollment, { ...f.target, attemptId });
    expect(await f.t.query(internal.fingerprintEnrollment.getAttempt, { ...f.target, attemptId })).toBe(false);
    await expect(f.t.mutation(internal.fingerprintEnrollment.upsert, { ...f.target, attemptId, enrolledBy: f.userId, expectedCardNumber: "123" })).rejects.toThrow("iptal");
    await f.t.mutation(internal.fingerprintEnrollment.finishAttempt, { ...f.target, attemptId });
    expect(await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").collect())).toHaveLength(0);
  });
  it("sensör beklerken kart değişirse metadata başarı olarak yazılmaz", async () => {
    const f = await fixture();
    const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { cardNumber: "456" }));
    await expect(f.t.mutation(internal.fingerprintEnrollment.upsert, { ...f.target, attemptId, enrolledBy: f.userId, expectedCardNumber: "123" })).rejects.toThrow("değişti");
  });
  it.each(["card", "inactive", "remove", "termination", "import"])("%s yaşam döngüsü metadata temizliğini sıraya koyar", async operation => {
    const f = await fixture();
    await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    if (operation === "card") await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, cardNumber: "456" });
    if (operation === "inactive") await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, isActive: false });
    if (operation === "remove") await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
    if (operation === "termination") await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, employmentEndDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10), terminationType: "resignation" });
    if (operation === "import") await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "456" }] });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    const purge = jobs.find(job => job.name === "actions/hikFingerprint:purgeFingerprintsOnDevices");
    expect(purge?.args).toEqual([{ snapshots: [{ enrollmentId: expect.any(String), deviceId: f.deviceId, fingerNo: 2, employeeNo: "123" }] }]);
    expect(await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").collect())).toHaveLength(1);
  });
  it("180 saniyelik kilit ve normalize kart karşılaştırması", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.employeeId, { cardNumber: " 123 " }));
    const before = Date.now();
    const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    const row = await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").first());
    expect(row?.pendingUntil).toBeGreaterThanOrEqual(before + 180_000);
    await expect(f.t.mutation(internal.fingerprintEnrollment.upsert, { ...f.target, attemptId, enrolledBy: f.userId, expectedCardNumber: "123" })).resolves.toBeNull();
  });
  it("başarısız temizlikte eski kart korunur, tekrar kayıt engellenir", async () => {
    const f = await fixture();
    const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    await f.t.mutation(internal.fingerprintEnrollment.upsert, { ...f.target, attemptId, enrolledBy: f.userId, expectedCardNumber: "123" });
    await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, cardNumber: "456" });
    await f.t.mutation(internal.fingerprintEnrollment.removeAllForEmployee, { employeeId: f.employeeId, employeeNo: "456" });
    const row = await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").first());
    expect(row?.deletionEmployeeNo).toBe("123");
    await f.t.run(async ctx => { if (row) await ctx.db.patch(row._id, { pendingUntil: undefined }); });
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target)).rejects.toThrow("eski parmak");
    expect((await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).enrollments).toHaveLength(1);
  });
});
