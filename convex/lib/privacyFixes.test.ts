import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { MutationCtx, ActionCtx, QueryCtx } from "../_generated/server";
import { getFunctionName } from "convex/server";

const mocks = vi.hoisted(() => ({ capture: vi.fn(), fingerprint: vi.fn() }));
vi.mock("./customFunctions", () => {
  const wrap = (config: unknown) => config;
  return { authedMutation: wrap, authedQuery: wrap, authedAction: wrap, };
});
vi.mock("./auth", () => ({
  requireSetupSecret: vi.fn(), getProjectIdsForUser: vi.fn(async () => ["project-a"]),
  isProjectAllowed: (ids: string[], id: string) => ids.includes(id),
  requireEmployeeAccess: vi.fn(async () => ({ projectId: "project-a" })),
}));
vi.mock("./hikGateway", () => ({ captureFaceOnDevice: mocks.capture, addFingerprintToDevice: mocks.fingerprint }));
vi.mock("./biometricDestructionState", () => ({ hasActiveDestructionRun: vi.fn(async () => false) }));

import { ensureProjectForNewUser, assignProjectsToExistingUsers } from "../onboarding";
import { captureFaceFromDevice } from "../actions/hikGatewayDevice";
import { processHikQueue } from "../actions/hikQueueWorker";
import { claimLocalBridgeOperations } from "../hikvisionSync";
import { assertBiometricDeviceAllowed, getEmployeeBiometricModule } from "../privacyBiometric";
import { getCardReadings } from "../actions/getChatData";

function handler<C>(fn: unknown) {
  const definition = fn as { handler?: (ctx: C, args: object) => Promise<unknown>; _handler?: (ctx: C, args: object) => Promise<unknown> };
  const run = definition.handler ?? definition._handler;
  if (!run) throw new Error("Handler bulunamadı");
  return run;
}
beforeEach(() => vi.clearAllMocks());

describe("KVKK inceleme düzeltmeleri", () => {
  it.each(["signup", "assignment"])("%s yeni projeyi biyometri kapalı ve audit ile oluşturur", async mode => {
    const user = { _id: "user-a", role: "member", name: "Test", email: "test@example.com" };
    const insert = vi.fn(async (table: string) => table === "projects" ? "project-a" : "new-row");
    const ctx = { user, db: { insert, patch: vi.fn(), query: () => ({
      collect: async () => [user], withIndex: () => ({ first: async () => null }),
    }) } } as unknown as MutationCtx;
    await handler<MutationCtx>(mode === "signup" ? ensureProjectForNewUser : assignProjectsToExistingUsers)(ctx, mode === "signup" ? {} : { secret: "test" });
    expect(insert).toHaveBeenCalledWith("projectPrivacySettings", expect.objectContaining({ projectId: "project-a", biometricEnabled: false }));
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ projectId: "project-a", action: "create", newValue: { biometricEnabled: false } }));
  });
  it("yüz yakalamadan önce cihaz projesinin biyometri kapısını çağırır", async () => {
    const error = new ConvexError({ code: "BIOMETRIC_DISABLED", message: "Biyometri modülü kapalı." });
    const runQuery = vi.fn().mockResolvedValueOnce(["project-a"])
      .mockResolvedValueOnce({ projectId: "project-a", hikTransport: "gateway", hikDevIndex: "dev" }).mockResolvedValueOnce(true).mockRejectedValueOnce(error);
    await expect(handler<ActionCtx>(captureFaceFromDevice)({ runQuery, user: { role: "project_admin" } } as unknown as ActionCtx, { deviceId: "device-a" })).rejects.toMatchObject({ data: { code: "BIOMETRIC_DISABLED" } });
    expect(getFunctionName(runQuery.mock.calls[2][0])).toBe("roles:checkPermission");
    expect(getFunctionName(runQuery.mock.calls[3][0])).toBe("privacyBiometric:assertBiometricDeviceAllowed");
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it("cihaz kapısı veritabanındaki gerçek projenin kapalı ayarını reddeder", async () => {
    const ctx = { db: { get: async () => ({ projectId: "project-a" }), query: () => ({ withIndex: () => ({ first: async () => ({ biometricEnabled: false }) }) }) } } as unknown as QueryCtx;
    await expect(handler<QueryCtx>(assertBiometricDeviceAllowed)(ctx, { deviceId: "device-a" })).rejects.toMatchObject({ data: { code: "BIOMETRIC_DISABLED" } });
    await expect(handler<QueryCtx>(getEmployeeBiometricModule)(ctx, { employeeId: "employee-a" })).resolves.toEqual({ enabled: false });
  });
  it("retry adayından sonra kapı kapanırsa parmak izi dış cihaza gönderilmez", async () => {
    const candidate = { _id: "op-a", operation: "addFingerprint", payload: { employeeId: "employee-a", fingerPrintID: 1 },
      device: { _id: "device-a", hikDevIndex: "dev" }, employee: { cardNumber: "123" }, fingerprint: { fingerData: "data" } };
    const runQuery = vi.fn().mockResolvedValueOnce([candidate]).mockRejectedValueOnce(new Error("Kapalı"));
    const runMutation = vi.fn();
    const result = await handler<ActionCtx>(processHikQueue)({ runQuery, runMutation } as unknown as ActionCtx, {});
    expect(result).toEqual({ retried: 1, ok: 0, failed: 1 });
    expect(getFunctionName(runQuery.mock.calls[1][0])).toBe("hikvisionSync:assertBiometricSyncAllowed");
    expect(runQuery.mock.calls[1][1]).toEqual({ employeeId: "employee-a", deviceId: "device-a" });
    expect(mocks.fingerprint).not.toHaveBeenCalled();
  });
  it("bridge kapalı biyometri eklemesini temizlik eşiğinde failed yapar; silme devam eder", async () => {
    const device = { _id: "device-a", brand: "hikvision", hikTransport: "localBridge", projectId: "project-a", apiToken: "token", isActive: true };
    const patch = vi.fn();
    const ops = [{ _id: "add", operation: "addFace", attemptCount: 0 }, { _id: "delete", operation: "deleteFace", attemptCount: 0 }];
    const take = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(ops);
    const ctx = { db: { patch, query: (table: string) => ({ withIndex: () => ({
      first: async () => table === "devices" ? device : { biometricEnabled: false }, take,
    }) }) } } as unknown as MutationCtx;
    await handler<MutationCtx>(claimLocalBridgeOperations)(ctx, { token: "token" });
    expect(patch).toHaveBeenCalledWith("add", expect.objectContaining({ status: "failed", attemptCount: 5 }));
    expect(patch).toHaveBeenCalledWith("delete", expect.objectContaining({ status: "processing" }));
  });
  it("kullanıcının okuma tablosunda gerçek adı korur, gizlilik sorgusunu çağırmaz", async () => {
    const runQuery = vi.fn(async () => ({ page: [{ projectId: "project-a", employeeName: "Ali Yılmaz", cardNo: "123", accessTime: "2026-10-19T06:00:00Z" }], isDone: true, continueCursor: "end" }));
    const result = await handler<ActionCtx>(getCardReadings)({ runQuery } as unknown as ActionCtx, { projectId: "project-a" });
    expect(result).toMatchObject({ readings: [{ name: "Ali Yılmaz" }] });
    expect(runQuery).toHaveBeenCalledOnce();
  });
});
