// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { VIRTUAL_READER_TYPE } from "./lib/virtualReader";
import { mobileOperationAllowed } from "./lib/mobileAccess";
import { dispatchDoorOpen } from "./lib/doorOpenDispatch";

const wire = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("./lib/gateway/core", () => ({ gatewayApiCallChecked: wire.send }));
const modules = import.meta.glob("./**/*.ts");
const now = "2026-11-25T09:00:00.000Z";

async function fixture(transport: "ide" | "gateway" | "bridge" = "ide") {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now)); vi.stubEnv("MOBILE_IDE_ISOLATION_VERIFIED", "true");
  wire.send.mockReset();
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Visitor project", isActive: true });
    const userId = await ctx.db.insert("users", { role: "super_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 });
    const ruleId = await ctx.db.insert("accessRules", { projectId, name: "Visitor", targetType: "visitor", isActive: true,
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] });
    const visitorId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Visitor", email: "ada@example.test", cardNumber: "123456", isVisitor: true, visitorCredential: "pass", isActive: true, accessRuleId: ruleId,
      accessStartsAt: "2026-11-25T08:00:00Z", accessExpiresAt: "2026-11-25T18:00:00Z" });
    const panelId = await ctx.db.insert("devices", { projectId, name: "Physical panel", brand: transport === "ide" ? "ide_smart" : "hikvision",
      ...(transport === "ide" ? { ideUuid: "panel-ide", ideDoorCount: 1 } : { hikDevIndex: "panel-gateway", hikDoorCount: 1, hikTransport: transport === "bridge" ? "localBridge" as const : "gateway" as const }),
      isActive: true, lastSeen: now, createdAt: now, updatedAt: now });
    const doorId = await ctx.db.insert("doors", { projectId, deviceId: panelId, name: "Entry", ioId: 0, hikDoorNo: 1, status: "active" });
    const readerToken = crypto.randomUUID();
    const readerId = await ctx.db.insert("devices", { projectId, name: "Kiosk", brand: "other", deviceType: VIRTUAL_READER_TYPE, apiToken: readerToken, virtualReaderDoorId: doorId, isActive: true, accessDirection: "entry", createdAt: now, updatedAt: now });
    await ctx.db.insert("groupMembers", { projectId, groupId: ruleId, employeeId: visitorId, createdAt: now });
    const linkId = await ctx.db.insert("groupDoors", { projectId, groupId: ruleId, deviceId: panelId, doorId, createdAt: now });
    return { projectId, visitorId, panelId, doorId, readerToken, readerId, ruleId, linkId, userId, sessionId };
  });
  const admin = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  return { ...ids, t, admin };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("visitor kiosk door dispatch", () => {
  it.each(["qr", "pin"] as const)("grants an exhausted %s exit and queues its door without consuming another entry", async source => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 1 });
    const scan = () => source === "qr"
      ? f.t.mutation(api.virtualReaders.scan, { readerToken: f.readerToken, code: issued.token })
      : f.t.mutation(api.virtualReaders.scanPin, { readerToken: f.readerToken, pin: issued.pin });
    expect(await scan()).toMatchObject({ status: "granted", direction: "entry", doorOpen: "pending" });
    expect(await scan()).toEqual({ status: "denied", reason: "EXHAUSTED" });
    vi.advanceTimersByTime(1000);
    await f.t.run(ctx => ctx.db.patch(f.readerId, { accessDirection: "exit" }));
    const exit = await scan();
    expect(exit).toMatchObject({ status: "granted", direction: "exit", doorOpen: "pending" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 1, status: "exhausted" });
    if (!("doorOpenOperationId" in exit) || !exit.doorOpenOperationId) throw new Error("Missing exit operation");
    const operationId = exit.doorOpenOperationId;
    const allowed = () => f.t.run(async ctx => { const operation = await ctx.db.get(operationId); return operation && mobileOperationAllowed(ctx, operation); });
    expect(await allowed()).toBe(true);
    const commands = await f.t.run(ctx => ctx.db.query("idePendingOperations").take(10));
    expect(commands).toHaveLength(2);
    expect(commands.every(command => command.opType === "openDoor")).toBe(true);
    await f.admin.mutation(api.visitorPasses.revoke, { visitorId: f.visitorId });
    expect(await scan()).toEqual({ status: "denied", reason: "REVOKED" });
    expect(await allowed()).toBe(false);
    expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").take(10))).toHaveLength(2);
  });

  it.each(["expired", "inactive"] as const)("rejects an exhausted exit when the visitor is %s", async state => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 1 });
    const scan = () => f.t.mutation(api.virtualReaders.scan, { readerToken: f.readerToken, code: issued.token });
    expect(await scan()).toMatchObject({ status: "granted" });
    await f.t.run(async ctx => {
      await ctx.db.patch(f.readerId, { accessDirection: "exit" });
      await ctx.db.patch(f.visitorId, state === "expired" ? { accessExpiresAt: now } : { isActive: false });
    });
    expect(await scan()).toEqual({ status: "denied", reason: state === "expired" ? "EXPIRED" : "NOT_ACTIVE" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 1, status: "exhausted" });
    expect(await f.t.run(ctx => ctx.db.query("idePendingOperations").take(10))).toHaveLength(1);
  });

  it.each(["qr", "pin"] as const)("queues %s with the final consumed entry and confirms through the existing IDE channel", async source => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 1 });
    const result = source === "qr" ? await f.t.mutation(api.virtualReaders.scan, { readerToken: f.readerToken, code: issued.token })
      : await f.t.mutation(api.virtualReaders.scanPin, { readerToken: f.readerToken, pin: issued.pin });
    expect(result).toMatchObject({ status: "granted", doorOpen: "pending" });
    if (!("doorOpenOperationId" in result) || !result.doorOpenOperationId) throw new Error("Missing operation");
    const operationId = result.doorOpenOperationId;
    const op = await f.t.run(ctx => ctx.db.get(operationId));
    expect(op).toMatchObject({ visitorPassId: issued.passId, employeeId: f.visitorId, deviceId: f.panelId, doorId: f.doorId });
    expect(op).not.toHaveProperty("sessionId"); expect(op).not.toHaveProperty("authVersion");
    expect(await f.t.run(async ctx => { const row = await ctx.db.get(operationId); return row && mobileOperationAllowed(ctx, row); })).toBe(true);
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ status: "exhausted", usedCount: 1 });
    const command = await f.t.run(ctx => ctx.db.query("idePendingOperations").filter(q => q.eq(q.field("opType"), "openDoor")).first());
    if (!command) throw new Error("Missing command");
    expect(command).toMatchObject({ maxAttempts: 1, payload: { ioId: 0, keep: 1, mobileOperationId: operationId } });
    await f.t.mutation(internal.ideSync.markSent, { opId: command._id, msxId: 42 });
    await f.t.mutation(internal.ideSync.markAck, { opId: command._id, msxId: 42, result: "success" });
    expect(await f.t.query(api.mobileAccess.visitorDoorOpenStatus, { readerToken: f.readerToken, operationId })).toEqual({ doorOpen: "confirmed" });
    expect(await f.t.query(api.mobileAccess.visitorDoorOpenStatus, { readerToken: crypto.randomUUID(), operationId })).toBeNull();
    const readings = await f.t.run(ctx => ctx.db.query("cardReadings").take(10));
    expect(readings).toHaveLength(1);
    expect(JSON.parse(readings[0].rawData ?? "{}")).toMatchObject({ doorOpen: "confirmed", protocol: "visitor_pass" });
    expect(JSON.stringify({ op, readings, command })).not.toContain(issued.token);
    expect(JSON.stringify({ op, readings, command })).not.toContain(`"${issued.pin}"`);
  });

  it.each(["offline", "unsupported", "bridge"] as const)("returns failed for %s without rolling back the consumed entry", async kind => {
    const f = await fixture(kind === "bridge" ? "bridge" : "ide");
    if (kind === "offline") await f.t.run(ctx => ctx.db.patch(f.panelId, { lastSeen: "2026-11-25T08:00:00Z" }));
    if (kind === "unsupported") vi.stubEnv("MOBILE_IDE_ISOLATION_VERIFIED", "false");
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId, maxUses: 1 });
    expect(await f.t.mutation(api.virtualReaders.scan, { readerToken: f.readerToken, code: issued.token })).toMatchObject({ status: "granted", doorOpen: "failed", doorOpenMessage: "Kapı açılamadı — resepsiyona başvurun" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 1, status: "exhausted" });
    expect(await f.t.run(ctx => ctx.db.query("mobileAccessOperations").take(10))).toEqual([]);
    const reading = await f.t.run(ctx => ctx.db.query("cardReadings").first());
    expect(reading?.accessStatus).toBe("izin_verildi");
    expect(JSON.parse(reading?.rawData ?? "{}")).toMatchObject({ doorOpen: "failed" });
  });

  it.each(["revoke", "rotate", "expired", "rule", "doorScope", "readerDisabled", "readerDoor"] as const)("revalidates %s before command delivery", async kind => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    await f.t.mutation(api.virtualReaders.scan, { readerToken: f.readerToken, code: issued.token });
    if (kind === "revoke") await f.admin.mutation(api.visitorPasses.revoke, { visitorId: f.visitorId });
    if (kind === "rotate") await f.admin.mutation(api.visitorPasses.regenerate, { visitorId: f.visitorId });
    await f.t.run(async ctx => {
      if (kind === "expired") await ctx.db.patch(f.visitorId, { accessExpiresAt: now });
      if (kind === "rule") await ctx.db.patch(f.ruleId, { isActive: false });
      if (kind === "doorScope") await ctx.db.delete(f.linkId);
      if (kind === "readerDisabled") await ctx.db.patch(f.readerId, { isActive: false });
      if (kind === "readerDoor") await ctx.db.patch(f.readerId, { virtualReaderDoorId: undefined });
    });
    expect((await f.t.query(internal.ideSync.listPendingForBridge, {})).ops).toEqual([]);
  });

  it.each([true, false])("reports gateway acknowledgement %s asynchronously and preserves usage", async ack => {
    const f = await fixture("gateway");
    wire.send.mockResolvedValue({ ok: ack });
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    const result = await f.t.mutation(api.virtualReaders.scan, { readerToken: f.readerToken, code: issued.token });
    if (!("doorOpenOperationId" in result) || !result.doorOpenOperationId) throw new Error("Missing operation");
    await vi.advanceTimersByTimeAsync(0); await f.t.finishInProgressScheduledFunctions();
    expect(wire.send).toHaveBeenCalledExactlyOnceWith("/ISAPI/AccessControl/RemoteControl/door/1", "PUT", { RemoteControlDoor: { cmd: "open" } }, "panel-gateway");
    expect(await f.t.query(api.mobileAccess.visitorDoorOpenStatus, { readerToken: f.readerToken, operationId: result.doorOpenOperationId })).toMatchObject({ doorOpen: ack ? "confirmed" : "failed" });
    const reading = await f.t.run(ctx => ctx.db.query("cardReadings").first());
    expect(reading?.accessStatus).toBe("izin_verildi");
    expect(JSON.parse(reading?.rawData ?? "{}")).toMatchObject({ doorOpen: ack ? "confirmed" : "failed" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 1 });
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
  });

  it("expires an unclaimed command with failed kiosk feedback", async () => {
    const f = await fixture();
    const issued = await f.admin.mutation(api.visitorPasses.issue, { visitorId: f.visitorId });
    const result = await f.t.mutation(api.virtualReaders.scanPin, { readerToken: f.readerToken, pin: issued.pin });
    if (!("doorOpenOperationId" in result) || !result.doorOpenOperationId) throw new Error("Missing operation");
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await f.t.query(api.mobileAccess.visitorDoorOpenStatus, { readerToken: f.readerToken, operationId: result.doorOpenOperationId })).toMatchObject({ doorOpen: "failed" });
    expect(await f.t.run(ctx => ctx.db.get(issued.passId))).toMatchObject({ usedCount: 1 });
  });

  it("retains the local bridge queue payload in the shared dispatcher", async () => {
    const f = await fixture("bridge");
    await f.t.run(async ctx => {
      const operationId = await ctx.db.insert("mobileAccessOperations", { projectId: f.projectId, employeeId: f.visitorId,
        requestId: "transport-fixture", deviceId: f.panelId, doorId: f.doorId, deviceName: "Bridge", requestedAt: now, status: "pending", transport: "hik_local_bridge", actuator: 1 });
      const device = await ctx.db.get(f.panelId);
      if (!device) throw new Error("Missing panel");
      await dispatchDoorOpen(ctx, operationId, device, 1);
      expect(await ctx.db.query("hikPendingOperations").first()).toMatchObject({ operation: "openDoor", payload: { doorNo: 1, mobileOperationId: operationId }, attemptCount: 0 });
    });
  });
});
