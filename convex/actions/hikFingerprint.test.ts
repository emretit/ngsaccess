import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import { enrollFingerprintOnDevice, removeFingerprintFromDevice, purgeFingerprintsOnDevices } from "./hikFingerprint";

const gateway = vi.hoisted(() => ({ captureFingerprintLive: vi.fn(), addFingerprintToDevice: vi.fn(), deleteFingerprintFromDevice: vi.fn() }));
vi.mock("../lib/gateway/biometrics", () => gateway);
const target = { employee: { cardNumber: "123" }, device: { hikDevIndex: "dev" } };
const args = { employeeId: "employee-a", deviceId: "device-a", fingerNo: 2, attemptId: "attempt-a" };
function fixture() {
  const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]): Promise<unknown> => {
    const name = getFunctionName(ref);
    if (name === "users:currentUser") return { _id: "user-a", role: "project_admin" };
    if (name.endsWith(":getPurgeDevice")) return "dev";
    if (name.endsWith(":getAttempt")) return true;
    if (name.endsWith(":getInternal")) return { ...args, _id: "row-a", deletionEmployeeNo: "OLD" };
    return target;
  });
  const runMutation = vi.fn(async (_ref: Parameters<typeof getFunctionName>[0], _args: object) => null);
  return { ctx: { runQuery, runMutation } as unknown as ActionCtx, runQuery, runMutation };
}
function invoke(fn: unknown, ctx: ActionCtx, input: object) { return (fn as { _handler: (ctx: ActionCtx, input: object) => Promise<unknown> })._handler(ctx, input); }
beforeEach(() => { vi.resetAllMocks(); gateway.captureFingerprintLive.mockResolvedValue({ ok: true, fingerData: String.fromCharCode(115, 101, 99, 114, 101, 116) }); gateway.addFingerprintToDevice.mockResolvedValue({ ok: true }); gateway.deleteFingerprintFromDevice.mockResolvedValue({ ok: true }); });

describe("cihazda parmak izi action", () => {
  it("capture → aynı cihaza download; metadata/audit argümanlarında şablon yok", async () => {
    const f = fixture();
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).resolves.toBeNull();
    expect(gateway.captureFingerprintLive).toHaveBeenCalledWith("dev", { fingerPrintID: 2 });
    expect(gateway.addFingerprintToDevice.mock.calls[0][0]).toBe("dev");
    expect(Object.keys(gateway.addFingerprintToDevice.mock.calls[0][1]).sort()).toEqual(["employeeNo", "fingerData", "fingerPrintID"].sort());
    for (const call of f.runMutation.mock.calls) expect(JSON.stringify(call)).not.toContain(String.fromCharCode(115, 101, 99, 114, 101, 116));
    expect(f.runMutation.mock.calls.map(call => getFunctionName(call[0]))).toContain("fingerprintEnrollment:upsert");
  });
  it.each(["captureFingerprintLive timeout", "notSupport", "raw transport failure"])("cihaz hatası %s Türkçe ve gövdesiz döner", async error => {
    const f = fixture();
    gateway.captureFingerprintLive.mockResolvedValue({ ok: false, error });
    await expect(invoke(enrollFingerprintOnDevice, f.ctx, args)).rejects.toThrow(error.includes("timeout") ? "zaman aşımına" : error === "notSupport" ? "desteklemiyor" : "tamamlayamadı");
    expect(gateway.addFingerprintToDevice).not.toHaveBeenCalled();
  });
  it("capture sonrası iptal download yapmaz", async () => {
    const f = fixture(); let checks = 0;
    f.runQuery.mockImplementation(async ref => getFunctionName(ref) === "users:currentUser" ? { _id: "user-a", role: "project_admin" } : getFunctionName(ref).endsWith(":getAttempt") ? ++checks === 1 : target);
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
    await expect(invoke(removeFingerprintFromDevice, f.ctx, { enrollmentId: "row-a" })).rejects.toThrow("silinemedi");
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
    expect(calls[calls.length - 1]?.[1]).toMatchObject({ ok: mode === "success", label: mode === "success" ? "Parmak izi silme: komut iletildi" : "Parmak izi silme: başarısız" });
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
      if (name === "users:currentUser") return { _id: "user-a", role: "project_admin" };
      if (name.endsWith(":getInternal")) return { ...args, _id: "row-a", deletionEmployeeNo: "OLD" };
      return target;
    });
    await invoke(removeFingerprintFromDevice, f.ctx, { enrollmentId: "row-a" });
    expect(gateway.deleteFingerprintFromDevice).toHaveBeenCalledWith("dev", "OLD", 2);
  });
});
