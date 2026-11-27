import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { api } from "./_generated/api";
import * as faces from "./employeeFaces";

vi.mock("./_generated/server", () => ({ mutation: (config: unknown) => config, internalQuery: (config: unknown) => config, internalMutation: (config: unknown) => config }));
vi.mock("./lib/customFunctions", () => ({ authedQuery: (config: unknown) => config, authedMutation: (config: unknown) => config, authedAction: (config: unknown) => config }));
const guards = vi.hoisted(() => ({ permission: vi.fn(), allowed: vi.fn(), access: vi.fn(), devices: vi.fn(), audit: vi.fn() }));
vi.mock("./lib/auth", () => ({ requireEmployeeAccess: guards.access }));
vi.mock("./lib/permissions", () => ({ requirePermission: guards.permission }));
vi.mock("./lib/biometricGate", () => ({ assertBiometricAllowed: guards.allowed }));
vi.mock("./fingerprintEnrollment", () => ({ employeeDevices: guards.devices }));
vi.mock("./lib/audit", () => ({ writeAudit: guards.audit }));

type Row = Record<string, unknown>;
function fixture() {
  const employee = { _id: "employee", firstName: "Ada", lastName: "Test", email: "", projectId: "project", cardNumber: "123", isActive: true };
  const device = { _id: "device", projectId: "project", name: "Panel", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "dev" };
  const tables: Record<string, Row[]> = { employees: [employee], devices: [device], users: [{ _id: "user" }], employeeFaces: [], hikPendingOperations: [] };
  const ranges: string[] = [];
  guards.access.mockResolvedValue(employee); guards.devices.mockResolvedValue([device]);
  const ctx = {
    user: { _id: "user" },
    db: {
      query: (table: string) => {
        let rows = tables[table] ?? [];
        const index = { eq: (field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return index; } };
        const chain = { withIndex: (name: string, configure: (q: typeof index) => unknown) => { ranges.push(`${table}:${name}`); configure(index); return chain; }, order: (direction: string) => { rows = [...rows].sort((a, b) => direction === "desc" ? Number(b._creationTime ?? b.createdAt ?? 0) - Number(a._creationTime ?? a.createdAt ?? 0) : Number(a._creationTime ?? a.createdAt ?? 0) - Number(b._creationTime ?? b.createdAt ?? 0)); return chain; }, take: async (n: number) => rows.slice(0, n), unique: async () => rows[0] ?? null, first: async () => rows[0] ?? null, async *[Symbol.asyncIterator]() { yield* rows; } };
        return chain;
      },
      get: vi.fn(async (id: string) => Object.values(tables).flat().find(row => row._id === id) ?? null),
      insert: vi.fn(async (table: string, value: Row) => { const id = `${table}-${tables[table]?.length ?? 0}`; (tables[table] ??= []).push({ ...value, _id: id, _creationTime: Date.now() }); return id; }),
      patch: vi.fn(async (id: string, value: Row) => { for (const table of Object.keys(tables)) tables[table] = tables[table].map(row => row._id === id ? table === "employees" ? Object.assign(row, value) : { ...row, ...value } : row); }),
      delete: vi.fn(async (id: string) => { for (const table of Object.keys(tables)) tables[table] = tables[table].filter(row => row._id !== id); }),
    },
    storage: { delete: vi.fn(), store: vi.fn(async () => "stored") },
    scheduler: { runAfter: vi.fn() },
    runQuery: vi.fn(), runMutation: vi.fn(),
  };
  return { ctx, tables, employee, device, ranges };
}
async function invoke<T = null>(fn: unknown, ctx: unknown, args: object): Promise<T> {
  return (fn as { handler: (ctx: unknown, args: object) => Promise<T> }).handler(ctx, args);
}
const photo = new Uint8Array([255, 216, 10, 255, 217]).buffer;
const saveArgs = { employeeId: "employee", storageId: "new", userId: "user" };
beforeEach(() => vi.resetAllMocks());

describe("yüz kayıt yetkisi ve saklama", () => {
  it("preserves imported identity when the physical card is empty or changes before face delivery", async () => {
    const f = fixture();
    Object.assign(f.employee, { cardNumber: "", hikEmployeeNo: "device-person" });
    await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    expect(f.tables.employees[0].deviceSyncUpdatedAt).toBeUndefined();
    expect(f.tables.hikPendingOperations[0]).toMatchObject({ payload: { employeeNo: "device-person" } });
    f.employee.cardNumber = "456";
    const targets = await invoke<unknown[]>(faces.startDelivery, f.ctx, { employeeId: "employee", operationIds: ["hikPendingOperations-0"] });
    expect(targets).toMatchObject([{ employeeNo: "device-person" }]);
  });
  it.each(["missing", "granted", "revoked", "grantedAgain"])("internal storage sorgusu eski rıza kayıtlarından bağımsızdır: %s", async state => {
    const f = fixture();
    f.tables.employeeFaces.push({ _id: "face", employeeId: "employee", pictureStorageId: "file", projectId: "project" });
    f.tables.employeeConsents = state === "missing" ? [] : [{ employeeId: "employee", consentType: "biometric_face", revokedAt: state === "revoked" ? "2026-01-02" : undefined }];
    expect(await invoke(faces.getStorageRef, f.ctx, { employeeId: "employee" })).toMatchObject({ pictureStorageId: "file" });
  });
  it("yalnız JPEG imzası ve 200KB sınırını kabul eder", () => {
    expect(() => faces.validateFacePhoto(photo)).not.toThrow();
    expect(() => faces.validateFacePhoto(new ArrayBuffer(4))).toThrow("JPEG");
    expect(() => faces.validateFacePhoto(new ArrayBuffer(200 * 1024 + 1))).toThrow("200 KB");
  });
  it("yüz metadata sorgusu biyometri yetkisi ve kişi kapsamını denetler; fotoğraf URL'si dönmez", async () => {
    const f = fixture();
    const result = await invoke<FunctionReturnType<typeof api.employeeFaces.listForEmployee>>(faces.listForEmployee, f.ctx, { employeeId: "employee" });
    expect(guards.access).toHaveBeenCalledWith(f.ctx, "employee");
    expect(guards.permission).toHaveBeenCalledWith(f.ctx, f.ctx.user, "project", "biometrics.manage");
    expect(result.registered).toBe(false); expect(result.devices[0].status).toBe("unknown");
    expect(JSON.stringify(result)).not.toContain("StorageId");
    guards.permission.mockRejectedValue(new Error("yetki yok"));
    await expect(invoke(faces.listForEmployee, f.ctx, { employeeId: "employee" })).rejects.toThrow("yetki yok");
  });
  it("capture öncesi kişi ve cihaz aynı aktif erişim kapsamında olmalıdır", async () => {
    const f = fixture();
    await invoke(faces.authorizeUpload, f.ctx, { employeeId: "employee", userId: "user", deviceId: "device" });
    await expect(invoke(faces.authorizeUpload, f.ctx, { employeeId: "employee", userId: "user", deviceId: "other" })).rejects.toThrow("kapsamında");
  });
  it.each(["inactive", "cardless", "module", "scope", "permission"])("%s durumda kaydetmez", async kind => {
    const f = fixture();
    if (kind === "inactive") f.employee.isActive = false;
    if (kind === "cardless") f.employee.cardNumber = " ";
    if (kind === "module") guards.allowed.mockRejectedValue(new Error("modül kapalı"));
    if (kind === "scope") guards.access.mockRejectedValue(new Error("proje kapsamı"));
    if (kind === "permission") guards.permission.mockRejectedValue(new Error("yetki yok"));
    await expect(invoke(faces.saveStoredPhoto, f.ctx, saveArgs)).rejects.toThrow();
    expect(f.ctx.db.insert).not.toHaveBeenCalled();
  });
  it("tek merkezi kayıt oluşturur ve yalnız Hik hedefleri için snapshot kuyruklar", async () => {
    const f = fixture(); await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    expect(f.tables.employeeFaces).toMatchObject([{ employeeId: "employee", pictureStorageId: "new" }]);
    expect(f.tables.hikPendingOperations).toMatchObject([{ deviceId: "device", operation: "addFace", status: "pending", payload: { employeeNo: "123", faceStorageId: "new", replacing: false } }]);
    expect(f.ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });
  it("değiştirirken eski storage'ı kaldırır, devam eden gönderimde yeni kayıt yapmaz", async () => {
    const f = fixture(); f.tables.employeeFaces.push({ _id: "face", employeeId: "employee", pictureStorageId: "old" });
    await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    expect(f.tables.employeeFaces).toHaveLength(1); expect(f.ctx.storage.delete).toHaveBeenCalledWith("old");
    expect(f.tables.hikPendingOperations[0].payload).toMatchObject({ replacing: true });
    await expect(invoke(faces.saveStoredPhoto, f.ctx, saveArgs)).rejects.toThrow("bitmesini");
  });
  it("başarısız kaydetmede yeni blob temizlenir", async () => {
    const f = fixture(); f.ctx.runMutation.mockRejectedValue(new Error("değişti"));
    await expect(invoke(faces.savePhoto, f.ctx, { employeeId: "employee", bytes: photo })).rejects.toThrow("değişti");
    expect(f.ctx.storage.delete).toHaveBeenCalledWith("stored");
  });
  it("silme modül kapalı veya kişi pasifken de yapılır; eski kart kimliği kuyrukta korunur", async () => {
    const f = fixture(); f.employee.isActive = false;
    f.tables.employeeFaces.push({ _id: "face", employeeId: "employee", pictureStorageId: "old" });
    f.tables.hikPendingOperations.push({ _id: "old-op", employeeId: "employee", projectId: "project", deviceId: "device", operation: "addFace", status: "done", createdAt: 1, payload: { employeeId: "employee", employeeNo: "previous", faceStorageId: "old" } });
    await invoke(faces.remove, f.ctx, { employeeId: "employee" });
    expect(f.tables.employeeFaces).toEqual([]); expect(guards.allowed).not.toHaveBeenCalled();
    expect(f.tables.hikPendingOperations.filter(row => row.operation === "deleteFace").map(row => (row.payload as Row).employeeNo)).toEqual(["123", "previous"]);
  });
  it("gönderim öncesinde kayıt/proje/modül tekrar doğrulanır", async () => {
    const f = fixture(); await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    f.employee.cardNumber = "456";
    const result = await invoke<unknown[]>(faces.startDelivery, f.ctx, { employeeId: "employee", operationIds: ["hikPendingOperations-0"] });
    expect(result).toEqual([]); expect(f.tables.hikPendingOperations[0].status).toBe("failed");
  });
  it("cihaz teslimi tamamlanınca merkezi kayıt ve teslim durumu birlikte okunur", async () => {
    const f = fixture(); await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    await invoke(faces.startDelivery, f.ctx, { employeeId: "employee", operationIds: ["hikPendingOperations-0"] });
    expect(f.tables.hikPendingOperations[0].status).toBe("processing");
    await invoke(faces.finishDelivery, f.ctx, { results: [{ operationId: "hikPendingOperations-0", ok: true }] });
    const result = await invoke<FunctionReturnType<typeof api.employeeFaces.listForEmployee>>(faces.listForEmployee, f.ctx, { employeeId: "employee" });
    expect(result.registered).toBe(true); expect(result.busy).toBe(false); expect(result.devices[0].status).toBe("done");
  });
  it("kısmi silme hatası yeni kaydı engeller ve eski snapshot ile yeniden denenir", async () => {
    const f = fixture();
    f.tables.hikPendingOperations.push({ _id: "old-delete", employeeId: "employee", projectId: "project", deviceId: "device", operation: "deleteFace", status: "failed", createdAt: 1, payload: { employeeId: "employee", employeeNo: "123", faceStorageId: "old" } });
    await expect(invoke(faces.saveStoredPhoto, f.ctx, saveArgs)).rejects.toThrow("silme");
    await invoke(faces.remove, f.ctx, { employeeId: "employee" });
    const retry = f.tables.hikPendingOperations[1];
    await invoke(faces.startDelivery, f.ctx, { employeeId: "employee", operationIds: [retry._id] });
    await invoke(faces.finishDelivery, f.ctx, { results: [{ operationId: retry._id, ok: true }] });
    expect(f.tables.hikPendingOperations[0].status).toBe("done");
  });
  it("başarılı teslim yalnız aynı kişi+cihaz+yüz+kimlik hata kayıtlarını kapatır", async () => {
    const f = fixture();
    const payload = { employeeId: "employee", employeeNo: "123", faceStorageId: "face-a" };
    f.tables.hikPendingOperations.push(...[
      { _id: "current", status: "processing", payload }, { _id: "matching", status: "failed", payload },
      { _id: "other-face", status: "failed", payload: { ...payload, faceStorageId: "face-b" } },
      { _id: "other-person", status: "failed", payload: { ...payload, employeeId: "other" } },
    ].map(row => ({ ...row, employeeId: "employee", projectId: "project", deviceId: "device", operation: "addFace", createdAt: 1 })));
    await invoke(faces.finishDelivery, f.ctx, { results: [{ operationId: "current", ok: true }] });
    expect(f.tables.hikPendingOperations.map(row => row.status)).toEqual(["done", "done", "failed", "failed"]);
  });
  it("E2: proje kuyruğunun büyüklüğü yüz kartını kilitlemez; yalnız çalışan+işlem indeksi okunur", async () => {
    const f = fixture();
    f.tables.hikPendingOperations.push(...Array.from({ length: 2000 }, (_, i) => ({ _id: `unrelated-${i}`, employeeId: "other", projectId: "project", deviceId: "device", operation: "addPerson", status: "done", createdAt: i })));
    f.tables.hikPendingOperations.push(...Array.from({ length: 60 }, (_, i) => ({ _id: `face-${i}`, employeeId: "employee", projectId: "project", deviceId: "device", operation: "addFace", status: i === 59 ? "failed" : "done", createdAt: i, payload: { employeeId: "employee", employeeNo: "123" } })));
    const result = await invoke<FunctionReturnType<typeof api.employeeFaces.listForEmployee>>(faces.listForEmployee, f.ctx, { employeeId: "employee" });
    expect(result.devices[0].status).toBe("failed");
    expect(f.ranges.filter(value => value.startsWith("hikPendingOperations:"))).toEqual(["hikPendingOperations:by_employee_operation", "hikPendingOperations:by_employee_operation"]);
    await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    expect(f.tables.hikPendingOperations[f.tables.hikPendingOperations.length - 1]).toMatchObject({ employeeId: "employee" });
  });
  it("E2: eski indekssiz işler başarı diye sunulmaz", async () => {
    const f = fixture();
    f.tables.hikPendingOperations.push({ _id: "legacy", projectId: "project", deviceId: "device", operation: "addFace", status: "done", payload: { employeeId: "employee" } });
    const result = await invoke<FunctionReturnType<typeof api.employeeFaces.listForEmployee>>(faces.listForEmployee, f.ctx, { employeeId: "employee" });
    expect(result.devices[0].status).toBe("unknown");
  });
  it("D4: başka kişiye devredilmiş geçmiş kartın yüzünü silmez (sayısal alias dahil)", async () => {
    const f = fixture();
    f.tables.employees.push({ _id: "other", projectId: "project", cardNumber: "000456" });
    f.tables.hikPendingOperations.push({ _id: "old", employeeId: "employee", projectId: "project", deviceId: "device", operation: "addFace", status: "done", createdAt: 1, payload: { employeeId: "employee", employeeNo: "456" } });
    await invoke(faces.remove, f.ctx, { employeeId: "employee" });
    const deletions = f.tables.hikPendingOperations.filter(row => row.operation === "deleteFace");
    expect(deletions.map(row => (row.payload as Row).employeeNo)).toEqual(["123"]);
  });
  it("D4: kart kuyruklandıktan sonra başka kişiye verilirse cihaz silmesi başlamaz", async () => {
    const f = fixture(); await invoke(faces.remove, f.ctx, { employeeId: "employee" });
    f.tables.employees.push({ _id: "other", projectId: "project", cardNumber: "123" });
    expect(await invoke(faces.startDelivery, f.ctx, { employeeId: "employee", operationIds: ["hikPendingOperations-0"] })).toEqual([]);
    expect(f.tables.hikPendingOperations[0].status).toBe("failed");
  });
  it.each(["addFace", "deleteFace"])("D5: dismissed done %s başarı sayılmaz", async operation => {
    const f = fixture();
    f.tables.hikPendingOperations.push({ _id: "dismissed", employeeId: "employee", projectId: "project", deviceId: "device", operation, status: "done", dismissedAt: 1, createdAt: 1, payload: { employeeId: "employee", employeeNo: "123" } });
    const result = await invoke<FunctionReturnType<typeof api.employeeFaces.listForEmployee>>(faces.listForEmployee, f.ctx, { employeeId: "employee" });
    expect(result.devices[0].status).toBe("failed");
    if (operation === "deleteFace") await expect(invoke(faces.saveStoredPhoto, f.ctx, saveArgs)).rejects.toThrow("silme");
  });
  it.each(["replace", "remove"])("D6: %s profil fotoğrafının kullandığı blob'u korur", async mode => {
    const f = fixture();
    f.tables.employeeFaces.push({ _id: "face", employeeId: "employee", pictureStorageId: "shared" });
    f.tables.employees.push({ _id: "profile", cardNumber: "999", photoStorageId: "shared" });
    await invoke(mode === "replace" ? faces.saveStoredPhoto : faces.remove, f.ctx, mode === "replace" ? saveArgs : { employeeId: "employee" });
    expect(f.ctx.storage.delete).not.toHaveBeenCalledWith("shared");
    expect(f.ranges).toContain("employees:by_photo_storage");
  });
  it.each(["failed", "pending", "processing"])("N6: hedef dışı veya silinmiş cihazdaki %s silme işi yeni kaydı kilitlemez", async status => {
    const f = fixture();
    f.tables.hikPendingOperations.push({ _id: "old", employeeId: "employee", projectId: "project", deviceId: "missing", operation: "deleteFace", status, createdAt: Date.now(), payload: { employeeId: "employee", employeeNo: "123" } });
    await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    expect(f.tables.employeeFaces).toHaveLength(1);
  });
  it("N6: var olan fakat erişim kapsamından çıkarılan cihazın işi busy veya kayıt kilidi sayılmaz", async () => {
    const f = fixture(); guards.devices.mockResolvedValue([]);
    f.tables.hikPendingOperations.push({ _id: "previous-target", employeeId: "employee", projectId: "project", deviceId: "device", operation: "deleteFace", status: "processing", createdAt: Date.now(), payload: { employeeId: "employee", employeeNo: "123" } });
    const result = await invoke<FunctionReturnType<typeof api.employeeFaces.listForEmployee>>(faces.listForEmployee, f.ctx, { employeeId: "employee" });
    expect(result.busy).toBe(false); expect(result.devices[0].target).toBe(false);
    await invoke(faces.saveStoredPhoto, f.ctx, saveArgs);
    expect(f.tables.employeeFaces).toHaveLength(1);
    expect(f.tables.hikPendingOperations[0].status).toBe("processing");
  });
});

  it.each(["cardNumber", "hikEmployeeNo"])("D11: foreign project %s does not block planning or executing face removal", async field => {
    const f = fixture();
    f.tables.employees.push({ _id: "foreign", projectId: "elsewhere", [field]: "123" });
    await invoke(faces.remove, f.ctx, { employeeId: "employee" });
    expect(f.tables.hikPendingOperations.filter(row => row.operation === "deleteFace")).toHaveLength(1);
    expect(await invoke(faces.startDelivery, f.ctx, { employeeId: "employee", operationIds: ["hikPendingOperations-0"] })).toMatchObject([{ employeeNo: "123" }]);
  });

// Fake transports test handler behavior; dashboardSummary.test.ts covers real DB hooks.
vi.mock("./lib/dashboardSummary", async importOriginal => ({
  ...await importOriginal<typeof import("./lib/dashboardSummary")>(),
  withDashboardSummary: <T,>(ctx: T) => ctx,
}));
