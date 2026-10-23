// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
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
    expect(registered.length).toBeGreaterThanOrEqual(11);
    for (const fn of registered) expect(JSON.parse(fn.exportReturns())).not.toBeNull();
  });
  it("snapshot yokken denemeye izin verir, şablonsuz metadata yazar ve cihaz adı döner", async () => {
    const f = await fixture();
    const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    expect((await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).devices).toEqual([{ _id: f.deviceId, name: "Panel", capabilitiesScanned: false }]);
    await f.t.mutation(internal.fingerprintEnrollment.upsert, { ...f.target, attemptId, enrolledBy: f.userId, expectedCardNumber: "123" });
    const rows = await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").collect());
    expect(Object.keys(rows[0]).sort()).toEqual(["_creationTime", "_id", "deviceId", "employeeId", "enrolledAt", "enrolledBy", "enrolledEmployeeNo", "fingerNo", "projectId"].sort());
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
  it("kişi başına 5 parmak izi: 6+ slot ve dolu kişide yeni kayıt reddedilir, mevcut slot yeniden kaydedilir", async () => {
    const f = await fixture();
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, { ...f.target, fingerNo: 6 })).rejects.toThrow("en fazla 5");
    await f.t.run(async ctx => { for (const fingerPrintID of [1, 2, 3, 4, 7]) await ctx.db.insert("employeeFingerprints", { employeeId: f.employeeId, projectId: f.projectId, fingerPrintID, encData: "e", iv: "i", keyVersion: "v1", addedAt: 1 }); });
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, { ...f.target, fingerNo: 5 })).rejects.toThrow("en fazla 5");
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, { ...f.target, fingerNo: 2 })).resolves.toBeTypeOf("string");
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
  it.each(["card", "inactive", "remove", "termination", "import", "consent"])("%s yaşam döngüsü metadata temizliğini sıraya koyar", async operation => {
    const f = await fixture();
    await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    await f.t.run(ctx => ctx.db.insert("employeeFingerprints", { employeeId: f.employeeId, projectId: f.projectId, fingerPrintID: 2, encData: "encrypted", iv: "iv", keyVersion: "v1", addedAt: Date.now(), enrolledBy: f.userId }));
    if (operation === "consent") await f.caller.mutation(api.employeeConsents.revoke, { id: f.consentId });
    if (operation === "card") await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, cardNumber: "456" });
    if (operation === "inactive") await f.caller.mutation(api.employees.update, { employeeId: f.employeeId, isActive: false });
    if (operation === "remove") await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
    if (operation === "termination") await f.caller.mutation(api.employeeTermination.terminate, { employeeId: f.employeeId, employmentEndDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10), terminationType: "resignation" });
    if (operation === "import") await f.caller.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: f.employeeId, cardNumber: "456" }] });
    expect(await f.t.run(ctx => ctx.db.query("employeeFingerprints").collect())).toHaveLength(["card", "import"].includes(operation) ? 1 : 0);
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

describe("encrypted central templates", () => {
  async function store(f: Awaited<ReturnType<typeof fixture>>) {
    const attemptId = await f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target);
    await f.t.mutation(internal.fingerprintEnrollment.upsert, { ...f.target, attemptId, enrolledBy: f.userId, expectedCardNumber: "123" });
    await f.t.mutation(internal.employeeFingerprints.upsertEncrypted, { employeeId: f.employeeId, fingerNo: 2, sourceDeviceId: f.deviceId, enrolledBy: f.userId, expectedCardNumber: "123", encData: "encrypted-only", iv: "private-iv", keyVersion: "v1" });
  }
  it("upserts a single employee/slot and exposes only public metadata", async () => {
    const f = await fixture();
    await store(f);
    await store(f);
    const central = await f.t.run(ctx => ctx.db.query("employeeFingerprints").collect());
    expect(central).toHaveLength(1);
    expect(central[0]).toMatchObject({ encData: "encrypted-only", sourceDeviceId: f.deviceId, enrolledBy: f.userId });
    const data = await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId });
    expect(data.templates).toEqual([{ fingerNo: 2, enrolledAt: expect.any(String), deviceIds: [f.deviceId] }]);
    for (const forbidden of ["encData", "iv", "fingerData", "encrypted-only", "private-iv"]) expect(JSON.stringify(data)).not.toContain(`"${forbidden}"`);
    expect(await f.t.query(internal.fingerprintEnrollment.getPushTarget, { employeeId: f.employeeId, deviceId: f.deviceId })).not.toBeNull();
  });
  it("recapture marks previous deliveries missing until the replacement is sent", async () => {
    const f = await fixture();
    await store(f);
    await f.t.run(async ctx => {
      const deviceId = await ctx.db.insert("devices", { projectId: f.projectId, name: "Other", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "other", createdAt: "now", updatedAt: "now" });
      await ctx.db.insert("deviceFingerprintEnrollments", { employeeId: f.employeeId, deviceId, fingerNo: 2, enrolledAt: new Date().toISOString(), enrolledBy: f.userId });
    });
    await store(f);
    const publicData = await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId });
    expect(publicData.templates[0].deviceIds).toEqual([f.deviceId]);
  });
  it.each(["consent", "module", "pending", "capability", "inactive"])("push target repeats %s eligibility check", async condition => {
    const f = await fixture();
    await store(f);
    await f.t.run(async ctx => {
      if (condition === "consent") await ctx.db.patch(f.consentId, { revokedAt: "now" });
      if (condition === "module") {
        const settings = await ctx.db.query("projectPrivacySettings").first();
        if (settings) await ctx.db.patch(settings._id, { biometricEnabled: false });
      }
      if (condition === "pending") {
        const row = await ctx.db.query("deviceFingerprintEnrollments").first();
        if (row) await ctx.db.patch(row._id, { pendingUntil: Date.now() + 10000 });
      }
      if (condition === "capability") await ctx.db.patch(f.deviceId, { hikCapabilitiesSnapshot: JSON.stringify({ probes: [{ key: "captureFingerprint", supported: false }] }) });
      if (condition === "inactive") await ctx.db.patch(f.employeeId, { isActive: false });
    });
    expect(await f.t.query(internal.fingerprintEnrollment.getPushTarget, { employeeId: f.employeeId, deviceId: f.deviceId })).toBeNull();
  });
  it("removal erases central template and queues devices with module off and consent revoked", async () => {
    const f = await fixture();
    await store(f);
    await f.t.run(async ctx => {
      await ctx.db.patch(f.consentId, { revokedAt: "now" });
      const settings = await ctx.db.query("projectPrivacySettings").first();
      if (settings) await ctx.db.patch(settings._id, { biometricEnabled: false });
    });
    await f.caller.mutation(api.fingerprintEnrollment.removeFingerprint, { employeeId: f.employeeId, fingerNo: 2 });
    expect(await f.t.run(ctx => ctx.db.query("employeeFingerprints").collect())).toHaveLength(0);
    expect((await f.t.run(ctx => ctx.db.query("deviceFingerprintEnrollments").first()))?.deletionEmployeeNo).toBe("123");
    expect((await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).templates[0].deviceIds).toEqual([]);
  });
  it("destruction deletes encrypted template and queues metadata device erasure", async () => {
    const f = await fixture();
    await store(f);
    await f.t.run(async ctx => {
      const settings = await ctx.db.query("projectPrivacySettings").first();
      if (settings) await ctx.db.patch(settings._id, { biometricEnabled: false });
    });
    const template = await f.t.run(ctx => ctx.db.query("employeeFingerprints").unique());
    if (!template) throw new Error("missing template fixture");
    const runId = await f.caller.mutation(api.biometricDestruction.startBiometricDestruction, { projectId: f.projectId, kinds: ["fingerprint"], confirmText: "A", reason: "İmha" });
    await f.t.mutation(internal.biometricDestruction.prepareBatch, { runId });
    await f.t.mutation(internal.biometricDestruction.finishBatch, { runId, batch: 1, item: { kind: "fingerprint", employeeId: f.employeeId, fingerprintId: template._id, fingerPrintID: 2, addedAt: template.addedAt, cardNumber: "123", targets: [], unconfirmed: 0 }, deviceOperations: 0, deviceFailures: 0, deviceUnconfirmed: 0, queuedOpIds: [] });
    expect(await f.t.run(ctx => ctx.db.query("employeeFingerprints").collect())).toHaveLength(0);
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.some(job => job.name === "actions/hikFingerprint:purgeFingerprintsOnDevices")).toBe(true);
  });
});

describe("fix1 transactional reservations and recovery", () => {
  async function template(f: Awaited<ReturnType<typeof fixture>>, fingerNo = 2) {
    return await f.t.run(ctx => ctx.db.insert("employeeFingerprints", { employeeId: f.employeeId, projectId: f.projectId, fingerPrintID: fingerNo, addedAt: Date.now() - 1000, encData: "ciphertext", iv: "iv", keyVersion: "v1", enrolledBy: f.userId }));
  }
  async function begin(f: Awaited<ReturnType<typeof fixture>>, templateId: Awaited<ReturnType<typeof template>>, force?: boolean) {
    const row = await f.t.run(ctx => ctx.db.get(templateId));
    if (!row) throw new Error("missing fixture");
    return await f.t.mutation(internal.fingerprintEnrollment.beginPush, { ...f.target, templateId, addedAt: row.addedAt, expectedCardNumber: "123", force });
  }
  it("dedupes current identity, force resends, and changed template/identity resends", async () => {
    const f = await fixture();
    const templateId = await template(f);
    const rowId = await f.t.run(ctx => ctx.db.insert("deviceFingerprintEnrollments", { ...f.target, enrolledBy: f.userId, enrolledAt: new Date().toISOString(), enrolledEmployeeNo: "123" }));
    expect(await begin(f, templateId)).toEqual({ current: true });
    const forced = await begin(f, templateId, true);
    expect(forced).toMatchObject({ enrollmentId: rowId, attemptId: expect.any(String) });
    await f.t.run(ctx => ctx.db.patch(rowId, { pendingUntil: undefined, deletionEmployeeNo: undefined, enrolledEmployeeNo: "OLD" }));
    expect(await begin(f, templateId)).toMatchObject({ enrollmentId: rowId });
    await f.t.run(ctx => ctx.db.patch(rowId, { pendingUntil: undefined, deletionEmployeeNo: undefined, enrolledEmployeeNo: "123", enrolledAt: "2000-01-01T00:00:00Z" }));
    expect(await begin(f, templateId)).toMatchObject({ enrollmentId: rowId });
  });
  it("consent revocation snapshots a pre-send reservation; record rejection retains retry metadata", async () => {
    const f = await fixture();
    const templateId = await template(f);
    const reservation = await begin(f, templateId);
    if (!reservation || "current" in reservation) throw new Error("expected reservation");
    const central = await f.t.run(ctx => ctx.db.get(templateId));
    if (!central) throw new Error("missing template");
    await f.caller.mutation(api.employeeConsents.revoke, { id: f.consentId });
    const row = await f.t.run(ctx => ctx.db.get(reservation.enrollmentId));
    expect(row).toMatchObject({ deletionEmployeeNo: "123", cancelRequested: true, pendingUntil: expect.any(Number) });
    await expect(f.t.mutation(internal.fingerprintEnrollment.recordPush, { ...f.target, templateId, addedAt: central.addedAt, expectedCardNumber: "123", attemptId: reservation.attemptId })).rejects.toThrow();
    await f.t.mutation(internal.fingerprintEnrollment.queuePushCleanup, { enrollmentId: reservation.enrollmentId, employeeNo: "123" });
    expect(await f.t.run(ctx => ctx.db.get(reservation.enrollmentId))).toMatchObject({ deletionEmployeeNo: "123", deletionRequestedAt: expect.any(Number) });
    expect((await f.t.run(ctx => ctx.db.get(reservation.enrollmentId)))?.pendingUntil).toBeUndefined();
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name === "actions/hikFingerprint:purgeFingerprintsOnDevices")).toHaveLength(2);
  });
  it("successful record clears reservation tombstone and records employeeNo", async () => {
    const f = await fixture();
    const templateId = await template(f);
    const reservation = await begin(f, templateId);
    if (!reservation || "current" in reservation) throw new Error("expected reservation");
    const central = await f.t.run(ctx => ctx.db.get(templateId));
    if (!central) throw new Error("missing template");
    await f.t.mutation(internal.fingerprintEnrollment.recordPush, { ...f.target, templateId, addedAt: central.addedAt, expectedCardNumber: "123", attemptId: reservation.attemptId });
    const row = await f.t.run(ctx => ctx.db.get(reservation.enrollmentId));
    expect(row?.enrolledEmployeeNo).toBe("123");
    expect(row?.deletionEmployeeNo).toBeUndefined();
    expect(row?.pendingUntil).toBeUndefined();
  });
  it("successful record resolves only the matching stale fingerprint warning", async () => {
    const f = await fixture();
    const templateId = await template(f);
    const failure = (fingerPrintID: number) => f.t.run(ctx => ctx.db.insert("hikPendingOperations", {
      projectId: f.projectId, deviceId: f.deviceId, operation: "addFingerprint", payload: { employeeId: f.employeeId, fingerPrintID },
      status: "failed", attemptCount: 1, lastError: "Parmak izi gönderilemedi", createdAt: Date.now(),
    }));
    const stale = await failure(2);
    const otherFinger = await failure(3);
    const reservation = await begin(f, templateId);
    if (!reservation || "current" in reservation) throw new Error("expected reservation");
    const central = await f.t.run(ctx => ctx.db.get(templateId));
    if (!central) throw new Error("missing template");
    await f.t.mutation(internal.fingerprintEnrollment.recordPush, { ...f.target, templateId, addedAt: central.addedAt, expectedCardNumber: "123", attemptId: reservation.attemptId });
    expect(await f.t.run(ctx => ctx.db.get(stale))).toMatchObject({ status: "done", completedAt: expect.any(Number) });
    expect(await f.t.run(ctx => ctx.db.get(otherFinger))).toMatchObject({ status: "failed" });
  });
  it("more than 1000 historical device rows do not block enrollment or target lookup", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 1001; i++) await ctx.db.insert("deviceFingerprintEnrollments", { employeeId: f.employeeId, deviceId: f.deviceId, fingerNo: 100 + i, enrolledAt: "", enrolledBy: f.userId });
    });
    expect(await f.t.query(internal.fingerprintEnrollment.getPushTarget, { employeeId: f.employeeId, deviceId: f.deviceId })).not.toBeNull();
    await expect(f.caller.mutation(api.fingerprintEnrollment.beginEnrollment, f.target)).resolves.toBeTypeOf("string");
  });
  it("an old identity tombstone does not block target selection for a new card", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("deviceFingerprintEnrollments", { ...f.target, enrolledBy: f.userId, enrolledAt: "", deletionEmployeeNo: "OLD" }));
    expect(await f.t.query(internal.fingerprintEnrollment.getPushTarget, { employeeId: f.employeeId, deviceId: f.deviceId })).not.toBeNull();
  });
  it("daily sweep pages old orphan tombstones, skips recent/active rows, and is registered", async () => {
    const f = await fixture();
    const oldId = await f.t.run(async ctx => {
      const oldId = await ctx.db.insert("deviceFingerprintEnrollments", { ...f.target, enrolledAt: "", enrolledBy: f.userId, deletionEmployeeNo: "123", deletionRequestedAt: Date.now() - 3_600_001 });
      await ctx.db.insert("deviceFingerprintEnrollments", { ...f.target, fingerNo: 3, enrolledAt: "", enrolledBy: f.userId, deletionEmployeeNo: "123", deletionRequestedAt: Date.now() });
      for (let i = 0; i < 100; i++) await ctx.db.insert("deviceFingerprintEnrollments", { ...f.target, fingerNo: 100 + i, enrolledAt: "", enrolledBy: f.userId });
      await ctx.db.delete(f.employeeId);
      return oldId;
    });
    await f.t.mutation(internal.fingerprintEnrollment.retryStalePurges, {});
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.find(job => job.name === "actions/hikFingerprint:purgeFingerprintsOnDevices")?.args).toEqual([{ snapshots: [{ enrollmentId: oldId, deviceId: f.deviceId, fingerNo: 2, employeeNo: "123" }] }]);
    expect(jobs.some(job => job.name === "fingerprintEnrollment:retryStalePurges")).toBe(true);
    const crons = (await import("./crons")).default;
    expect(JSON.parse((crons as unknown as { export: () => string }).export())["retry-fingerprint-purges"]).toMatchObject({ name: "fingerprintEnrollment:retryStalePurges", schedule: { cron: "30 4 * * *" } });
  });
  it("employee deletion schedules exactly one purge and removes the central template", async () => {
    const f = await fixture();
    await template(f);
    await f.t.run(ctx => ctx.db.insert("deviceFingerprintEnrollments", { ...f.target, enrolledBy: f.userId, enrolledAt: new Date().toISOString() }));
    await f.caller.mutation(api.employees.remove, { employeeId: f.employeeId });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs.filter(job => job.name === "actions/hikFingerprint:purgeFingerprintsOnDevices")).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("employeeFingerprints").first())).toBeNull();
  });
  it("sorts templates including source-only rows and audits removal/resend metadata only", async () => {
    const f = await fixture();
    await template(f, 8);
    await template(f, 2);
    await f.t.run(ctx => ctx.db.insert("deviceFingerprintEnrollments", { ...f.target, fingerNo: 1, enrolledBy: f.userId, enrolledAt: new Date().toISOString() }));
    expect((await f.caller.query(api.fingerprintEnrollment.listForEmployee, { employeeId: f.employeeId })).templates.map(row => row.fingerNo)).toEqual([1, 2, 8]);
    await f.caller.mutation(api.fingerprintEnrollment.auditResend, { employeeId: f.employeeId, fingerNo: 2 });
    await f.caller.mutation(api.fingerprintEnrollment.removeFingerprint, { employeeId: f.employeeId, fingerNo: 1 });
    const logs = await f.t.run(ctx => ctx.db.query("auditLog").collect());
    expect(logs).toHaveLength(2);
    expect(logs[0].newValue).toEqual({ employeeId: f.employeeId });
    expect(logs[0].note).toBe("Parmak izi yeniden gönderimi istendi; parmak no: 2; cihaz sayısı: 1");
    expect(logs[1].oldValue).toEqual({ employeeId: f.employeeId });
    expect(logs[1].note).toBe("Parmak izi silindi; parmak no: 1; cihaz sayısı: 1");
    expect(JSON.stringify(logs)).not.toMatch(/encData|fingerData|ciphertext/);
  });
  it("FP roster uses cheap eligibility checks without per-person scope resolution", async () => {
    const f = await fixture();
    await template(f);
    const { rosterCardNumbersWithBiometric } = await import("./lib/deviceSync");
    await f.t.run(async ctx => {
      const query = vi.spyOn(ctx.db, "query");
      try {
        expect(await rosterCardNumbersWithBiometric(ctx, new Set([f.employeeId]), "employeeFingerprints", f.deviceId)).toEqual(["123"]);
        expect(query.mock.calls.map(call => call[0])).not.toContain("groupMembers");
      } finally { query.mockRestore(); }
    });
    await f.t.run(ctx => ctx.db.patch(f.consentId, { revokedAt: "now" }));
    expect(await f.t.run(ctx => rosterCardNumbersWithBiometric(ctx, new Set([f.employeeId]), "employeeFingerprints", f.deviceId))).toEqual([]);
  });
});
