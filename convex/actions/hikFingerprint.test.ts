import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptTemplate } from "../lib/fingerprintCrypto";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import { enrollFingerprintOnDevice, removeFingerprintFromDevice, purgeFingerprintsOnDevices, pushFingerprintToDevices } from "./hikFingerprint";

const gateway = vi.hoisted(() => ({ captureFingerprintLive: vi.fn(), addFingerprintToDevice: vi.fn(), deleteFingerprintFromDevice: vi.fn() }));
vi.mock("../lib/gateway/biometrics", () => gateway);
const target = { employee: { cardNumber: "123" }, device: { hikDevIndex: "dev" } };
const args = { employeeId: "employee-a", deviceId: "device-a", fingerNo: 2, attemptId: "attempt-a" };
function fixture() {
  const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]): Promise<unknown> => {
    const name = getFunctionName(ref);
    if (name === "users:requireCurrentUser") return { _id: "user-a", role: "project_admin" };
    if (name.endsWith(":getPurgeDevice")) return "dev";
    if (name.endsWith(":getAttempt")) return true;
    if (name.endsWith(":getInternal")) return { ...args, _id: "row-a", deletionEmployeeNo: "OLD" };
    return target;
  });
  const runMutation = vi.fn(async (_ref: Parameters<typeof getFunctionName>[0], _args: object): Promise<unknown> => getFunctionName(_ref).endsWith(":beginPush") ? { enrollmentId: "row-a", attemptId: "push-a" } : null);
  const runAfter = vi.fn(async (_delay: number, _ref: unknown, _input: object) => null);
  return { ctx: { runQuery, runMutation, scheduler: { runAfter } } as unknown as ActionCtx, runQuery, runMutation, runAfter };
}
function invoke(fn: unknown, ctx: ActionCtx, input: object) { return (fn as { _handler: (ctx: ActionCtx, input: object) => Promise<unknown> })._handler(ctx, input); }
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => { vi.stubEnv("FINGERPRINT_TEMPLATE_KEY", btoa("k".repeat(32))); vi.resetAllMocks(); gateway.captureFingerprintLive.mockResolvedValue({ ok: true, fingerData: String.fromCharCode(115, 101, 99, 114, 101, 116) }); gateway.addFingerprintToDevice.mockResolvedValue({ ok: true }); gateway.deleteFingerprintFromDevice.mockResolvedValue({ ok: true }); });

describe("cihazda parmak izi action", () => {
  it("capture → aynı cihaza download; metadata/audit argümanlarında şablon yok", async () => {
    const f = fixture();
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).resolves.toBeNull();
    expect(gateway.captureFingerprintLive).toHaveBeenCalledWith("dev", { fingerPrintID: 2 });
    expect(gateway.addFingerprintToDevice.mock.calls[0][0]).toBe("dev");
    expect(Object.keys(gateway.addFingerprintToDevice.mock.calls[0][1]).sort()).toEqual(["employeeNo", "fingerData", "fingerPrintID"].sort());
    for (const call of f.runMutation.mock.calls) expect(JSON.stringify(call)).not.toContain(String.fromCharCode(115, 101, 99, 114, 101, 116));
    expect(f.runMutation.mock.calls.map(call => getFunctionName(call[0]))).toContain("fingerprintEnrollment:upsert");
    const central = f.runMutation.mock.calls.find(call => getFunctionName(call[0]) === "employeeFingerprints:upsertEncrypted");
    expect(central?.[1]).toMatchObject({ encData: expect.any(String), iv: expect.any(String), keyVersion: "v1" });
    expect(f.runAfter.mock.calls[0]).toEqual([0, expect.anything(), { employeeId: args.employeeId, fingerNo: 2, excludeDeviceId: args.deviceId }]);
  });
  it.each(["captureFingerprintLive timeout", "notSupport", "raw transport failure"])("cihaz hatası %s Türkçe ve gövdesiz döner", async error => {
    const f = fixture();
    gateway.captureFingerprintLive.mockResolvedValue({ ok: false, error });
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).rejects.toThrow(error.includes("timeout") ? "zaman aşımına" : error === "notSupport" ? "desteklemiyor" : "tamamlayamadı");
    expect(gateway.addFingerprintToDevice).not.toHaveBeenCalled();
  });
  it("capture sonrası iptal download yapmaz", async () => {
    const f = fixture(); let checks = 0;
    f.runQuery.mockImplementation(async ref => getFunctionName(ref) === "users:requireCurrentUser" ? { _id: "user-a", role: "project_admin" } : getFunctionName(ref).endsWith(":getAttempt") ? ++checks === 1 : target);
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).rejects.toThrow("iptal");
    expect(gateway.addFingerprintToDevice).not.toHaveBeenCalled();
  });
  it("download sonrası metadata reddi cihaz kaydını temizler", async () => {
    const f = fixture();
    f.runMutation.mockImplementation(async ref => { if (getFunctionName(ref).endsWith(":upsert")) throw new Error("state changed"); return null; });
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).rejects.toThrow("tamamlayamadı");
    expect(gateway.deleteFingerprintFromDevice).toHaveBeenCalledWith("dev", "123", 2);
  });
  it("silme cihaz başarısından sonra metadata siler; başarısızsa kaydı korur", async () => {
    const f = fixture();
    gateway.deleteFingerprintFromDevice.mockResolvedValue({ ok: false, error: "untrusted response" });
    await expect(invoke(removeFingerprintFromDevice, f.ctx, { enrollmentId: "row-a" })).rejects.toThrow("Sistemden silindi; cihazlardan silme yeniden denenecek");
    expect(f.runMutation.mock.calls.map(call => getFunctionName(call[0]))).not.toContain("fingerprintEnrollment:remove");
    gateway.deleteFingerprintFromDevice.mockResolvedValue({ ok: true });
    await invoke(removeFingerprintFromDevice, f.ctx, { enrollmentId: "row-a" });
    expect(f.runMutation.mock.calls.map(call => getFunctionName(call[0]))).toContain("fingerprintEnrollment:remove");
  });
});

describe("parmak izi purge", () => {
  it("tamamlanan eski iş tekrar çalışınca sonraki cihaz kaydını silmez", async () => {
    const f = fixture();
    f.runQuery.mockResolvedValue(null);
    await invoke(purgeFingerprintsOnDevices, f.ctx, { snapshots: [{ enrollmentId: "old-row", deviceId: "device-a", fingerNo: 2, employeeNo: "OLD" }] });
    expect(gateway.deleteFingerprintFromDevice).not.toHaveBeenCalled();
    expect(f.runMutation).not.toHaveBeenCalled();
  });
  it.each(["success", "failure", "throw", "missing-device"])("%s sonucu yalnız cihaz silinince metadata kaldırır", async mode => {
    const f = fixture();
    if (mode === "failure") gateway.deleteFingerprintFromDevice.mockResolvedValue({ ok: false, error: "deviceOffline" });
    if (mode === "throw") gateway.deleteFingerprintFromDevice.mockRejectedValue(new Error("untrusted"));
    if (mode === "missing-device") f.runQuery.mockImplementation(async ref => getFunctionName(ref).endsWith(":getPurgeDevice") ? null : { deletionEmployeeNo: "OLD" });
    const snapshots = [{ enrollmentId: "row-a", deviceId: "device-a", fingerNo: 2, employeeNo: "OLD" }];
    await expect(invoke(purgeFingerprintsOnDevices, f.ctx, { snapshots })).resolves.toBeNull();
    const calls = f.runMutation.mock.calls;
    expect(calls.some(call => getFunctionName(call[0]) === "fingerprintEnrollment:remove")).toBe(mode === "success");
    expect(calls[calls.length - 1]?.[1]).toMatchObject({ ok: mode === "success", label: mode === "success" ? "Parmak izi silme: komut iletildi" : "Parmak izi silme: başarısız (yeniden denenecek)" });
    if (mode !== "missing-device") expect(gateway.deleteFingerprintFromDevice).toHaveBeenCalledWith("dev", "OLD", 2);
  });
  it("bir cihaz başarısızken diğer cihazı temizlemeye devam eder", async () => {
    const f = fixture();
    gateway.deleteFingerprintFromDevice.mockRejectedValueOnce(new Error("offline"));
    await invoke(purgeFingerprintsOnDevices, f.ctx, { snapshots: [
      { enrollmentId: "row-a", deviceId: "device-a", fingerNo: 2, employeeNo: "OLD" },
      { enrollmentId: "row-b", deviceId: "device-b", fingerNo: 3, employeeNo: "OLD" },
    ] });
    const removals = f.runMutation.mock.calls.filter(call => getFunctionName(call[0]) === "fingerprintEnrollment:remove");
    expect(removals.map(call => call[1])).toEqual([{ enrollmentId: "row-b" }]);
  });
  it("kart değiştikten sonra elle silme eski cihaz kimliğini kullanır", async () => {
    const f = fixture();
    f.runQuery.mockImplementation(async ref => {
      const name = getFunctionName(ref);
      if (name === "users:requireCurrentUser") return { _id: "user-a", role: "project_admin" };
      if (name.endsWith(":getInternal")) return { ...args, _id: "row-a", deletionEmployeeNo: "OLD" };
      return target;
    });
    await invoke(removeFingerprintFromDevice, f.ctx, { enrollmentId: "row-a" });
    expect(gateway.deleteFingerprintFromDevice).toHaveBeenCalledWith("dev", "OLD", 2);
  });
});


describe("central capture and scoped distribution", () => {
  it("missing key rejects before capture", async () => {
    vi.stubEnv("FINGERPRINT_TEMPLATE_KEY", undefined);
    const f = fixture();
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).rejects.toThrow("saklama anahtarı");
    expect(gateway.captureFingerprintLive).not.toHaveBeenCalled();
  });
  it("central persistence failure retains the source and clears plaintext", async () => {
    const f = fixture();
    const capture = { ok: true, fingerData: "private" };
    gateway.captureFingerprintLive.mockResolvedValue(capture);
    f.runMutation.mockImplementation(async ref => { if (getFunctionName(ref) === "employeeFingerprints:upsertEncrypted") throw new Error("untrusted"); return null; });
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).rejects.toThrow("Cihazda kaydedildi, sisteme kaydedilemedi");
    expect(gateway.deleteFingerprintFromDevice).not.toHaveBeenCalled();
    expect(capture.fingerData).toBeUndefined();
  });
  it("excludes source, intersects requested targets, isolates failures and sends trimmed employeeNo", async () => {
    const f = fixture();
    const template = { _id: "template-a", employeeId: args.employeeId, fingerPrintID: 2, enrolledBy: "user-a", addedAt: 1, ...await encryptTemplate("private", `${args.employeeId}:2`) };
    f.runQuery.mockImplementation(async (ref) => {
      const name = getFunctionName(ref);
      if (name.endsWith(":listInternal")) return [template];
      if (name.endsWith(":getOne")) return template;
      if (name.endsWith(":getPushDevices")) return ["source", "a", "b", "outside"];
      return { employee: { cardNumber: " 123 " }, device: { hikDevIndex: "dev" } };
    });
    gateway.addFingerprintToDevice.mockRejectedValueOnce(new Error("private response"));
    await invoke(pushFingerprintToDevices, f.ctx, { employeeId: args.employeeId, excludeDeviceId: "source", deviceIds: ["source", "a", "b"] });
    expect(gateway.addFingerprintToDevice).toHaveBeenCalledTimes(2);
    expect(gateway.addFingerprintToDevice.mock.calls[1][1]).toMatchObject({ employeeNo: "123", fingerPrintID: 2, fingerData: "private" });
    expect(f.runMutation.mock.calls.filter(call => getFunctionName(call[0]).endsWith(":recordPush"))).toHaveLength(1);
    expect(JSON.stringify(f.runMutation.mock.calls)).not.toContain("private");
  });
  it("silently skips targets rejected for module, consent or pending capture", async () => {
    const f = fixture();
    f.runQuery.mockImplementation(async ref => {
      const name = getFunctionName(ref);
      if (name.endsWith(":listInternal")) return [{ fingerPrintID: 2 }];
      if (name.endsWith(":getPushDevices")) return ["a", "b", "c"];
      return null;
    });
    await invoke(pushFingerprintToDevices, f.ctx, { employeeId: args.employeeId });
    expect(gateway.addFingerprintToDevice).not.toHaveBeenCalled();
    expect(f.runMutation).not.toHaveBeenCalled();
  });
});

describe("fix1 durable cleanup and push outcomes", () => {
  const snapshots = [{ enrollmentId: "row-a", deviceId: "device-a", fingerNo: 2, employeeNo: "OLD" }];
  it.each([[0, 60_000], [1, 300_000], [2, 1_800_000], [3, 7_200_000], [4, 43_200_000]])("failed purge attempt %s backs off %s ms", async (attempts, delay) => {
    const f = fixture();
    gateway.deleteFingerprintFromDevice.mockResolvedValue({ ok: false });
    await invoke(purgeFingerprintsOnDevices, f.ctx, { snapshots, attempts });
    expect(f.runAfter.mock.calls[0]).toEqual([delay, expect.anything(), { snapshots, attempts: attempts + 1 }]);
  });
  it("stops self retries after eight attempts and keeps the visible tombstone", async () => {
    const f = fixture();
    gateway.deleteFingerprintFromDevice.mockRejectedValue(new Error("offline"));
    await invoke(purgeFingerprintsOnDevices, f.ctx, { snapshots, attempts: 7 });
    expect(f.runAfter).not.toHaveBeenCalled();
    expect(f.runMutation.mock.calls[0][1]).toMatchObject({ ok: false, label: "Parmak izi silme: başarısız (yeniden denenecek)" });
  });
  it("purge defers an in-flight send so cleanup cannot precede transport", async () => {
    const f = fixture();
    f.runQuery.mockResolvedValue({ deletionEmployeeNo: "OLD", pendingUntil: Date.now() + 10000 });
    await invoke(purgeFingerprintsOnDevices, f.ctx, { snapshots });
    expect(gateway.deleteFingerprintFromDevice).not.toHaveBeenCalled();
    expect(f.runAfter.mock.calls[0]).toEqual([180_000, expect.anything(), { snapshots, attempts: 0 }]);
  });
  async function pushFixture() {
    const f = fixture();
    const template = { _id: "template-a", employeeId: args.employeeId, fingerPrintID: 2, enrolledBy: "user-a", addedAt: 1, ...await encryptTemplate("private", `${args.employeeId}:2`) };
    f.runQuery.mockImplementation(async ref => {
      const name = getFunctionName(ref);
      if (name.endsWith(":listInternal")) return [template];
      if (name.endsWith(":getPushDevices")) return ["device-a"];
      return target;
    });
    return f;
  }
  it("reserves before transport; rejected recordPush hands cleanup to durable retry", async () => {
    const f = await pushFixture();
    f.runMutation.mockImplementation(async ref => {
      const name = getFunctionName(ref);
      if (name.endsWith(":beginPush")) return { enrollmentId: "row-a", attemptId: "push-a" };
      if (name.endsWith(":recordPush")) throw new Error("consent revoked");
      return null;
    });
    gateway.deleteFingerprintFromDevice.mockResolvedValue({ ok: false });
    await expect(invoke(pushFingerprintToDevices, f.ctx, { employeeId: args.employeeId })).resolves.toEqual({ ok: false });
    expect(f.runMutation.mock.invocationCallOrder[0]).toBeLessThan(gateway.addFingerprintToDevice.mock.invocationCallOrder[0]);
    expect(f.runMutation.mock.calls.find(call => getFunctionName(call[0]).endsWith(":queuePushCleanup"))?.[1]).toEqual({ enrollmentId: "row-a", employeeNo: "123" });
    expect(f.runMutation.mock.calls.find(call => getFunctionName(call[0]).endsWith(":recordSyncFailure"))?.[1]).toMatchObject({ operation: "addFingerprint", payload: { employeeId: args.employeeId, fingerPrintID: 2 } });
    expect(gateway.deleteFingerprintFromDevice).not.toHaveBeenCalled();
  });
  it("current delivery skips gateway writes; queue retries do not insert another failure", async () => {
    const f = await pushFixture();
    f.runMutation.mockResolvedValue({ current: true });
    await expect(invoke(pushFingerprintToDevices, f.ctx, { employeeId: args.employeeId })).resolves.toEqual({ ok: true });
    expect(gateway.addFingerprintToDevice).not.toHaveBeenCalled();
    f.runMutation.mockImplementation(async ref => getFunctionName(ref).endsWith(":beginPush") ? { enrollmentId: "row-a", attemptId: "push-a" } : null);
    gateway.addFingerprintToDevice.mockResolvedValue({ ok: false });
    await expect(invoke(pushFingerprintToDevices, f.ctx, { employeeId: args.employeeId, retrying: true })).resolves.toEqual({ ok: false });
    expect(f.runMutation.mock.calls.some(call => getFunctionName(call[0]).endsWith(":recordSyncFailure"))).toBe(false);
  });
  it("resend audits and forces delivery", async () => {
    const { resendFingerprint } = await import("./hikFingerprint");
    const f = fixture();
    await invoke(resendFingerprint, f.ctx, { employeeId: args.employeeId, fingerNo: 2 });
    expect(f.runMutation.mock.calls[0][0] && getFunctionName(f.runMutation.mock.calls[0][0])).toBe("fingerprintEnrollment:auditResend");
    expect(f.runAfter.mock.calls[0][2]).toEqual({ employeeId: args.employeeId, fingerNo: 2, force: true });
  });
});
