// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { destructionStateSchema, initialDestructionState } from "./lib/biometricDestruction";
import { HTTP_BODY_LIMIT, MULTIPART_BODY_LIMIT, cardReaderBodyLimit, readLimitedBody } from "./lib/cardReaderParse";

const modules = import.meta.glob("./**/*.ts");
const now = Date.parse("2026-10-26T10:00:00Z");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("OPENAI_API_KEY", "test"); vi.stubEnv("IDE_BRIDGE_SECRET", "bridge-secret"); vi.stubEnv("CARD_READER_ALLOW_UNAUTHENTICATED", "0"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Merkez" });
    const otherProjectId = await ctx.db.insert("projects", { name: "Başka" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const otherUserId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: now + 86400000 });
    const otherSessionId = await ctx.db.insert("authSessions", { userId: otherUserId, expirationTime: now + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    await ctx.db.insert("userProjects", { userId: otherUserId, projectId });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "test@test", cardNumber: "123", isActive: true });
    const deviceId = await ctx.db.insert("devices", { projectId, name: "Panel", brand: "hikvision", hikTransport: "localBridge", apiToken: "device-token", isActive: true, createdAt: "now", updatedAt: "now" });
    const enrollmentId = await ctx.db.insert("deviceFingerprintEnrollments", { projectId, employeeId, deviceId, fingerNo: 1, enrolledAt: "now", enrolledBy: userId });
    const eventId = await ctx.db.insert("deviceEvents", { projectId, deviceId, source: "system", category: "alarm", severity: "warning", label: "Test", eventTime: new Date(now).toISOString(), createdAt: "now", updatedAt: "now", alarmEmailStatus: "queued", alarmEmailAttempts: 0, alarmEmailRecipients: ["test@example.com"] });
    await ctx.db.insert("alarmSettings", { projectId, emailEnabled: true, recipients: ["test@example.com"], minSeverity: "warning", updatedAt: "now" });
    return { projectId, otherProjectId, userId, sessionId, otherUserId, otherSessionId, employeeId, deviceId, enrollmentId, eventId };
  });
  return { t, ...ids, caller: t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` }), otherCaller: t.withIdentity({ subject: `${ids.otherUserId}|${ids.otherSessionId}` }) };
}

describe("Y-06 asistan sınırı", () => {
  it("21. mesajı dış çağrı yapmadan reddeder; kullanıcıların kovaları ayrıdır", async () => {
    const f = await fixture();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "Hazır" } }] })));
    vi.stubGlobal("fetch", fetcher);
    const args = { projectId: f.projectId, input: "Durum?", dbContext: "ignored" };
    for (let i = 0; i < 20; i++) expect((await f.caller.action(api.actions.openaiChat.processMessage, args)).source).toBe("openai");
    expect(await f.caller.action(api.actions.openaiChat.processMessage, args)).toMatchObject({ source: "error", content: expect.stringContaining("20 mesaj") });
    expect(fetcher).toHaveBeenCalledTimes(20);
    expect((await f.otherCaller.action(api.actions.openaiChat.processMessage, args)).source).toBe("openai");
    expect(fetcher).toHaveBeenCalledTimes(21);
    vi.setSystemTime(now + 3600000);
    expect((await f.caller.action(api.actions.openaiChat.processMessage, args)).source).toBe("openai");
  });
  it("4001 karakter, oturumsuz ve başka proje çağrısını dış servise iletmez", async () => {
    const f = await fixture(); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const args = { projectId: f.projectId, input: "x".repeat(4001), dbContext: "" };
    expect(await f.caller.action(api.actions.openaiChat.processMessage, args)).toMatchObject({ source: "error", content: expect.stringContaining("4000") });
    await expect(f.t.action(api.actions.openaiChat.processMessage, { ...args, input: "Durum?" })).rejects.toThrow();
    await expect(f.caller.action(api.actions.openaiChat.processMessage, { ...args, input: "Durum?", projectId: f.otherProjectId })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("Y-05 alarm kurtarma", () => {
  it("claim 10 dk bekçi kurar; erken, eski ve sent kaydı için bekçi no-op olur", async () => {
    const f = await fixture();
    await f.t.mutation(internal.alarms.claimEmail, { eventId: f.eventId, attempt: 1 });
    const jobs = await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect());
    expect(jobs).toEqual([expect.objectContaining({ scheduledTime: now + 600000, args: [{ eventId: f.eventId, attempt: 1 }] })]);
    await f.t.mutation(internal.alarms.recoverEmail, { eventId: f.eventId, attempt: 1 });
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "sending" });
    await f.t.mutation(internal.alarms.recordEmailResult, { eventId: f.eventId, attempt: 1, failedRecipients: [] });
    vi.setSystemTime(now + 600000);
    await f.t.mutation(internal.alarms.recoverEmail, { eventId: f.eventId, attempt: 1 });
    expect(await f.t.run(ctx => ctx.db.get(f.eventId))).toMatchObject({ alarmEmailStatus: "sent" });
    expect(await f.t.run(ctx => ctx.db.system.query("_scheduled_functions").collect())).toHaveLength(1);
  });
});

describe("Y-04 eski parmak izi silme kanıtı", () => {
  it.each([false, true])("purge enrollment kimliklerini döndürür; kayıt silinmeden tutanağı tamamlamaz (projectless=%s)", async projectless => {
    const f = await fixture();
    if (projectless) await f.t.run(ctx => ctx.db.patch(f.enrollmentId, { projectId: undefined }));
    const runId = await f.t.run(ctx => ctx.db.insert("auditLog", { projectId: f.projectId, action: "create", targetTable: "biometricDestructionRun", targetId: f.projectId, timestamp: now, newValue: { ...initialDestructionState("Merkez", ["fingerprint"], "İmha", now + 1000), scan: "legacy" } }));
    await f.t.mutation(internal.biometricDestruction.prepareBatch, { runId });
    let state = destructionStateSchema.parse((await f.t.run(ctx => ctx.db.get(runId)))?.newValue);
    expect(state.pendingOpIds).toEqual([f.enrollmentId]);
    expect(await f.t.run(ctx => ctx.db.get(f.enrollmentId))).toMatchObject({ deletionEmployeeNo: "123", deletionRequestedAt: now });
    // Exercise the same final wait reached after the legacy employee scan.
    await f.t.run(ctx => ctx.db.patch(runId, { newValue: { ...state, status: "waitingDevices", pendingDeviceChecks: 1, deviceCheckDeadline: now + 86400000 } }));
    await f.t.mutation(internal.biometricDestruction.checkDeviceOperations, { runId, attempt: 0 });
    state = destructionStateSchema.parse((await f.t.run(ctx => ctx.db.get(runId)))?.newValue);
    expect(state.status).toBe("waitingDevices"); expect(state.pendingOpIds).toEqual([f.enrollmentId]);
    await f.t.run(ctx => ctx.db.delete(f.enrollmentId));
    await f.t.mutation(internal.biometricDestruction.checkDeviceOperations, { runId, attempt: 1 });
    state = destructionStateSchema.parse((await f.t.run(ctx => ctx.db.get(runId)))?.newValue);
    expect(state.status).toBe("completed"); expect(state.pendingOpIds).toEqual([]);
  });
  it("silme kanıtı süre aşımında tamamlandı yerine failed olur", async () => {
    const f = await fixture();
    expect(await f.t.mutation(internal.fingerprintEnrollment.removeAllForEmployee, { employeeId: f.employeeId, employeeNo: "123" })).toEqual([f.enrollmentId]);
    const runId = await f.t.run(ctx => ctx.db.insert("auditLog", { projectId: f.projectId, action: "create", targetTable: "biometricDestructionRun", targetId: f.projectId, timestamp: now, newValue: { ...initialDestructionState("Merkez", ["fingerprint"], "İmha", now), status: "waitingDevices", pendingOpIds: [f.enrollmentId], pendingDeviceChecks: 1, deviceCheckDeadline: now } }));
    await f.t.mutation(internal.biometricDestruction.checkDeviceOperations, { runId, attempt: 0 });
    expect(destructionStateSchema.parse((await f.t.run(ctx => ctx.db.get(runId)))?.newValue).status).toBe("failed");
  });
});

const bridgePaths = ["/ide-bridge/event", "/ide-bridge/poll", "/ide-bridge/sent", "/ide-bridge/ack", "/hik-bridge/poll", "/hik-bridge/ack"];
describe("C-11 HTTP giriş sınırı", () => {
  it("kimliksiz veya yanlış tokenlı istek gövdesini okumadan 401 verir", async () => {
    const f = await fixture();
    const reader = vi.spyOn(ReadableStream.prototype, "getReader");
    for (const path of ["/card-reader", ...bridgePaths]) {
      for (const token of [undefined, "wrong"]) {
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        expect((await f.t.fetch(path, { method: "POST", headers, body: "broken" })).status).toBe(401);
      }
    }
    expect(reader).not.toHaveBeenCalled();
  });
  it.each(["/card-reader", ...bridgePaths])("%s: boyut, JSON ve alan türünü doğrular", async path => {
    const f = await fixture();
    const headers = { Authorization: `Bearer ${path.startsWith("/ide") ? "bridge-secret" : "device-token"}`, "Content-Type": "application/json" };
    for (const extra of [{} , { "Content-Length": "66560" }] as Record<string, string>[]) expect((await f.t.fetch(path, { method: "POST", headers: { ...headers, ...extra }, body: "x".repeat(65 * 1024) })).status).toBe(413);
    for (const body of ["{broken", "null", "[]", JSON.stringify({ body: 3, max: "2", opId: [], msxId: "3", ok: "yes", cardNo: {} })]) expect((await f.t.fetch(path, { method: "POST", headers, body })).status).toBe(400);
  });
  it("sent geçersiz ID için 400; geçerli poll ve heartbeat aynı cevabı verir", async () => {
    const f = await fixture(); const headers = { Authorization: "Bearer bridge-secret", "Content-Type": "application/json" };
    expect((await f.t.fetch("/ide-bridge/sent", { method: "POST", headers, body: JSON.stringify({ opId: "invalid", msxId: 3 }) })).status).toBe(400);
    const poll = await f.t.fetch("/ide-bridge/poll", { method: "POST", headers, body: "{}" }); expect(poll.status).toBe(200);
    const heartbeat = await f.t.fetch("/card-reader", { method: "POST", headers: { ...headers, Authorization: "Bearer device-token" }, body: "{}" });
    expect(heartbeat.status).toBe(200); expect(await heartbeat.json()).toEqual({ cevap: "ok" });
  });
  it("/card-reader: resimli multipart Hik push'u 64 KB'ı aşsa da kabul eder, 1 MB üstünü reddeder", async () => {
    const f = await fixture();
    const boundary = "hikBoundary";
    const multipart = (size: number) => `--${boundary}\r\nContent-Disposition: form-data; name="Picture"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n${"x".repeat(size)}\r\n--${boundary}--\r\n`;
    const headers = { Authorization: "Bearer device-token", "Content-Type": `multipart/form-data; boundary=${boundary}` };
    expect((await f.t.fetch("/card-reader", { method: "POST", headers, body: multipart(200 * 1024) })).status).toBe(200);
    expect((await f.t.fetch("/card-reader", { method: "POST", headers, body: multipart(MULTIPART_BODY_LIMIT) })).status).toBe(413);
    expect(cardReaderBodyLimit("application/json")).toBe(HTTP_BODY_LIMIT);
    expect(cardReaderBodyLimit(null)).toBe(HTTP_BODY_LIMIT);
  });
  it("sınırı UTF-8 baytlarıyla sayar ve taşan akışı durdurur", async () => {
    await expect(readLimitedBody(new Request("https://test", { method: "POST", body: "a".repeat(HTTP_BODY_LIMIT) }))).resolves.toHaveLength(HTTP_BODY_LIMIT);
    await expect(readLimitedBody(new Request("https://test", { method: "POST", body: "ş".repeat(HTTP_BODY_LIMIT / 2 + 1) }))).rejects.toMatchObject({ status: 413 });
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(HTTP_BODY_LIMIT)); controller.enqueue(new Uint8Array(1)); }, cancel });
    await expect(readLimitedBody(new Request("https://test", { method: "POST", body: stream, duplex: "half" } as RequestInit))).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
