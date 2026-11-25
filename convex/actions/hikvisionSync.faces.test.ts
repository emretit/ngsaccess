import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { syncEmployeeFaceToDevicesInternal, deleteEmployeeFaceFromDevicesInternal } from "./hikvisionSync";
import { captureFaceFromDevice } from "./hikGatewayDevice";

vi.mock("../_generated/server", () => ({ internalAction: (config: unknown) => config }));
vi.mock("../lib/customFunctions", () => ({ authedAction: (config: unknown) => config }));
const mocks = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn(), capture: vi.fn() }));
vi.mock("../lib/hikGateway", () => ({ addFaceToDevice: mocks.add, deleteFaceFromDevice: mocks.remove }));
vi.mock("../lib/hikSyncEmployee", () => ({ makeProjectGuard: vi.fn(), bridgeDedupeKey: vi.fn(), removeScopedPerson: vi.fn(), syncEmployeeDevices: vi.fn(), syncEmployeeDoorRights: vi.fn(), syncWeekPlanDevices: vi.fn() }));
vi.mock("../lib/gatewayCommand", () => ({ runCaptureFaceFromDevice: mocks.capture }));
vi.mock("../lib/gatewayBackfill", () => ({}));
vi.mock("../lib/gatewayReconcile", () => ({}));

async function invoke<T = unknown>(fn: unknown, ctx: unknown, args: object): Promise<T> {
  return (fn as { handler: (ctx: unknown, args: object) => Promise<T> }).handler(ctx, args);
}
beforeEach(() => { vi.resetAllMocks(); mocks.add.mockResolvedValue({ ok: true }); mocks.remove.mockResolvedValue({ ok: true }); });

it("10 cihazın teslim sonucu tek toplu mutation ile tamamlanır", async () => {
  const targets = Array.from({ length: 10 }, (_, i) => ({ operationId: `op-${i}`, devIndex: `dev-${i}`, employeeNo: "123", storageId: "file", removing: false, replacing: false }));
  const ctx = { runMutation: vi.fn().mockResolvedValueOnce(targets).mockResolvedValueOnce(null), storage: { get: vi.fn(async () => new Blob([new Uint8Array([255, 216, 255, 217])])) } };
  await invoke(syncEmployeeFaceToDevicesInternal, ctx, { employeeId: "employee", operationIds: targets.map(row => row.operationId) });
  expect(mocks.add).toHaveBeenCalledTimes(10); expect(ctx.runMutation).toHaveBeenCalledTimes(2);
  const [ref, args] = ctx.runMutation.mock.calls[1];
  expect(getFunctionName(ref)).toBe("employeeFaces:finishDelivery"); expect(args.results).toHaveLength(10);
});
it("değiştirmede eski yüz kaldırılır ve cihaz hatası toplu sonuca yazılır", async () => {
  mocks.remove.mockResolvedValue({ ok: false, error: "offline" });
  const ctx = { runMutation: vi.fn().mockResolvedValueOnce([{ operationId: "op", devIndex: "dev", employeeNo: "123", storageId: "file", removing: false, replacing: true }]), storage: { get: vi.fn(async () => new Blob(["jpeg"])) } };
  await invoke(syncEmployeeFaceToDevicesInternal, ctx, { employeeId: "employee", operationIds: ["op"] });
  expect(mocks.add).not.toHaveBeenCalled(); expect(ctx.runMutation.mock.calls[1][1]).toEqual({ results: [{ operationId: "op", ok: false, error: "offline" }] });
});
it("silmede eski kimlik kullanılır; mevcut çalışan kartı okunmaz", async () => {
  const ctx = { runMutation: vi.fn().mockResolvedValueOnce([{ operationId: "op", devIndex: "dev", employeeNo: "old-card", storageId: null, removing: true }]) };
  await invoke(deleteEmployeeFaceFromDevicesInternal, ctx, { employeeId: "employee", operationIds: ["op"] });
  expect(mocks.remove).toHaveBeenCalledWith("dev", "old-card"); expect(mocks.add).not.toHaveBeenCalled();
});
it("capture kişi+cihaz yetkisi doğrulanmadan gateway'e gitmez", async () => {
  const ctx = { user: { _id: "user" }, runQuery: vi.fn().mockRejectedValue(new Error("yetki yok")) };
  await expect(invoke(captureFaceFromDevice, ctx, { employeeId: "employee", deviceId: "device" })).rejects.toThrow("yetki yok");
  expect(mocks.capture).not.toHaveBeenCalled();
  ctx.runQuery.mockResolvedValue(null);
  mocks.capture.mockResolvedValue({ ok: true, faceDataBase64: "/9j/2Q==" });
  await invoke(captureFaceFromDevice, ctx, { employeeId: "employee", deviceId: "device" });
  expect(mocks.capture).toHaveBeenCalledWith(ctx, { employeeId: "employee", deviceId: "device" });
});
