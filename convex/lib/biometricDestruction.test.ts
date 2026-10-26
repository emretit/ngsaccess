import { describe, expect, it } from "vitest";
import { deviceCheckDelay, DEVICE_WAIT_MS, MAX_PENDING_DEVICE_OPS, destructionReport, destructionSummary, initialDestructionState, normalizeKinds, splitDestructionBatches, summarizePreview, validateDestructionInput } from "./biometricDestruction";

describe("biyometrik imha planı", () => {
  it("türleri tekilleştirir ve yalnız seçilen şablonları sayar", () => {
    expect(normalizeKinds(["fingerprint", "face", "face"])).toEqual(["face", "fingerprint"]);
    expect(summarizePreview([{ employeeId: "a", pictureStorageId: "s" }], [{ employeeId: "a" }, { employeeId: "b" }], ["fingerprint"]))
      .toEqual({ faceCount: 0, fingerprintCount: 2, employeeCount: 2, storageFileCount: 0, capped: false });
  });
  it("aynı çalışan ve dosyayı bir kez sayar, üst sınırı alt sınır olarak bildirir", () => {
    const faces = [{ employeeId: "a", pictureStorageId: "s" }, { employeeId: "a", pictureStorageId: "s" }, { employeeId: "b", pictureStorageId: "t" }];
    expect(summarizePreview(faces, [{ employeeId: "a" }], ["face", "fingerprint"], 2))
      .toEqual({ faceCount: 2, fingerprintCount: 1, employeeCount: 1, storageFileCount: 1, capped: true });
  });
  it("her batch en fazla 100 kayıt içerir ve kayıt kaybetmez", () => {
    const rows = Array.from({ length: 205 }, (_, i) => i);
    const batches = splitDestructionBatches(rows, 100);
    expect(batches.map(batch => batch.length)).toEqual([100, 100, 5]);
    expect(batches.flat()).toEqual(rows);
    for (const size of [0, -1, 101, 1.5]) expect(() => splitDestructionBatches(rows, size)).toThrow();
  });
  it("proje adını tam karşılaştırır ve gerekçe sınırlarını doğrular", () => {
    expect(validateDestructionInput("Merkez", "Merkez", "İmha", ["face"])).toBeNull();
    for (const name of ["merkez", "Merkez ", ""]) expect(validateDestructionInput("Merkez", name, "İmha", ["face"])).not.toBeNull();
    for (const reason of ["  a ", "x".repeat(501)]) expect(validateDestructionInput("Merkez", "Merkez", reason, ["face"])).not.toBeNull();
    expect(validateDestructionInput("Merkez", "Merkez", "İmha", [])).not.toBeNull();
  });
  it("tutanak hata ve doğrulanmamış cihazları başarılı saymaz", () => {
    const state = { ...initialDestructionState("Merkez", ["face"], " İmha ", 10), status: "completed" as const, finishedAt: 20, deletedFaces: 3, deletedFiles: 2, deviceOperations: 5, deviceFailures: 1, deviceUnconfirmed: 2 };
    expect(destructionReport("p", state)).toMatchObject({ projectId: "p", kinds: ["face"], silinenYuz: 3, silinenParmak: 0, cihazHata: 1, cihazDogrulanamayan: 2, baslangic: 10, bitis: 20, gerekce: "İmha" });
    expect(destructionSummary(state)).toContain("cihaz silmesi başarısız: 1");
    expect(destructionSummary(state)).toContain("cihaz sonucu doğrulanamadı: 2");
  });
});

// No database/device access: execute the real handler bodies with bounded in-memory stubs.
import { vi, beforeEach } from "vitest";
import { previewBiometricDestruction, prepareBatch, createGatewayOperation, finishGatewayOperation, startBiometricDestruction, finishBatch, getDestructionRun, queueBridgeOperation, checkDeviceOperations, watchRun } from "../biometricDestruction";
import { hasActiveDestructionRun } from "./biometricDestructionState";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const mocks = vi.hoisted(() => ({ allowed: ["p"], audit: vi.fn() }));
vi.mock("./auth", () => ({ getProjectIdsForUser: async () => mocks.allowed }));
vi.mock("./audit", () => ({ writeAudit: mocks.audit }));
vi.mock("./customFunctions", () => ({ authedQuery: (value: unknown) => value, authedMutation: (value: unknown) => value }));
vi.mock("../_generated/server", () => ({ internalQuery: (value: unknown) => value, internalMutation: (value: unknown) => value }));

function createCtx() {
  const documents = new Map<string, unknown>([["p", { _id: "p", name: "Merkez" }]]);
  const tables = new Map<string, unknown[]>([["userProjects", [{ userId: "u", projectId: "p", role: "admin" }]]]);
  const ctx = {
    user: { _id: "u", role: "project_admin" },
    db: {
      normalizeId: vi.fn(() => null),
      get: vi.fn(async (id: string) => documents.get(id) ?? null),
      patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        const current = documents.get(id);
        documents.set(id, { ...(typeof current === "object" ? current : {}), ...patch });
      }), insert: vi.fn(async () => "gateway-op"), delete: vi.fn(async () => undefined),
      system: { get: vi.fn(async (): Promise<{ _id: string } | null> => ({ _id: "file" })) },
      query: vi.fn((table: string) => {
        const query = { withIndex: () => query, order: () => query,
          paginate: async () => ({ page: tables.get(table) ?? [], continueCursor: "end", isDone: true }),
          take: async () => tables.get(table) ?? [], first: async () => (tables.get(table) ?? [])[0] ?? null };
        return query;
      }),
    },
    runMutation: vi.fn(async () => "op"),
    storage: { delete: vi.fn(async () => undefined) },
    scheduler: { runAfter: vi.fn(async (_delay: number, _reference: unknown, _args: unknown) => "scheduled") },
  };
  return { ctx, documents, tables };
}
function handler(value: unknown) {
  if (!value || typeof value !== "object" || !("handler" in value) || typeof value.handler !== "function") throw new Error("Missing handler");
  return value.handler as (ctx: ReturnType<typeof createCtx>["ctx"], args: Record<string, unknown>) => Promise<unknown>;
}
const startArgs = { projectId: "p", kinds: ["face"], confirmText: "Merkez", reason: "İmha" };
const item = { kind: "face", employeeId: "employee", faceId: "face", storageId: "file", addedAt: 5, cardNumber: "123", targets: [], unconfirmed: 0 };
function seedRun(data: ReturnType<typeof createCtx>, overrides: Partial<ReturnType<typeof initialDestructionState>> = {}) {
  const state = { ...initialDestructionState("Merkez", ["face"], "İmha", 10), batch: 1, ...overrides };
  const row = { _id: "run", projectId: "p", targetTable: "biometricDestructionRun", newValue: state };
  data.documents.set("run", row);
  data.tables.set("auditLog", [row]);
  return state;
}
beforeEach(() => { mocks.allowed = ["p"]; mocks.audit.mockReset(); });

describe("imha sunucu korumaları", () => {
  it("yetkisiz proje yazmasını ve yanlış onay metnini herhangi bir yazmadan reddeder", async () => {
    const { ctx } = createCtx();
    mocks.allowed = [];
    await expect(handler(startBiometricDestruction)(ctx, startArgs)).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    mocks.allowed = ["p"];
    await expect(handler(startBiometricDestruction)(ctx, { ...startArgs, confirmText: "Yanlış" })).rejects.toThrow("proje adını tam");
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });
  it("eşzamanlı ikinci çalıştırmayı ve açık modülü reddeder", async () => {
    const data = createCtx();
    seedRun(data);
    await expect(handler(startBiometricDestruction)(data.ctx, startArgs)).rejects.toThrow("devam eden");
    data.tables.set("auditLog", []);
    await expect(handler(startBiometricDestruction)(data.ctx, startArgs)).rejects.toThrow("modülünü kapatın");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("başka projenin tutanağını runId ile okuyamaz", async () => {
    const data = createCtx();
    seedRun(data);
    data.documents.set("run", { _id: "run", projectId: "other", targetTable: "biometricDestructionRun" });
    expect(await handler(getDestructionRun)(data.ctx, { projectId: "p", runId: "run" })).toBeNull();
  });
  it("cihaz başarısız olsa da sadece şablon ve dosyayı siler, tekrar tamamlamayı yok sayar", async () => {
    const data = createCtx();
    seedRun(data);
    data.documents.set("face", { _id: "face", projectId: "p", addedAt: 5, pictureStorageId: "file" });
    await handler(finishBatch)(data.ctx, { runId: "run", batch: 1, item, deviceOperations: 2, deviceFailures: 2, deviceUnconfirmed: 0, queuedOpIds: [] });
    expect(data.ctx.db.delete).toHaveBeenCalledExactlyOnceWith("face");
    expect(data.ctx.storage.delete).toHaveBeenCalledExactlyOnceWith("file");
    expect(data.ctx.db.patch).toHaveBeenCalledWith("run", { newValue: expect.objectContaining({ deletedFaces: 1, deletedFiles: 1, deviceFailures: 2, batch: 2 }) });
    seedRun(data, { batch: 2 });
    await handler(finishBatch)(data.ctx, { runId: "run", batch: 1, item, deviceOperations: 2, deviceFailures: 2, deviceUnconfirmed: 0, queuedOpIds: [] });
    expect(data.ctx.db.delete).toHaveBeenCalledTimes(1);
  });
  it("yeni sürümü silmez ve profil fotoğrafıyla ortak dosyayı korur", async () => {
    const data = createCtx();
    seedRun(data);
    data.documents.set("face", { _id: "face", projectId: "p", addedAt: 6, pictureStorageId: "file" });
    const args = { runId: "run", batch: 1, item, deviceOperations: 0, deviceFailures: 0, deviceUnconfirmed: 0, queuedOpIds: [] };
    await handler(finishBatch)(data.ctx, args);
    expect(data.ctx.db.delete).not.toHaveBeenCalled();
    seedRun(data);
    data.documents.set("face", { _id: "face", projectId: "p", addedAt: 5, pictureStorageId: "file" });
    data.tables.set("employees", [{ _id: "profile-owner" }]);
    await handler(finishBatch)(data.ctx, args);
    expect(data.ctx.db.delete).toHaveBeenCalledExactlyOnceWith("face");
    expect(data.ctx.storage.delete).not.toHaveBeenCalled();
  });
  it("olmayan storage dosyasını atlar ama şablonu siler", async () => {
    const data = createCtx();
    seedRun(data);
    data.documents.set("face", { _id: "face", projectId: "p", addedAt: 5, pictureStorageId: "file" });
    data.ctx.db.system.get.mockImplementation(async () => null);
    await handler(finishBatch)(data.ctx, { runId: "run", batch: 1, item, deviceOperations: 0, deviceFailures: 0, deviceUnconfirmed: 0, queuedOpIds: [] });
    expect(data.ctx.storage.delete).not.toHaveBeenCalled();
    expect(data.ctx.db.delete).toHaveBeenCalledExactlyOnceWith("face");
  });
  it("snapshot sonrası başka projeye taşınmış cihaza işlem yazmaz", async () => {
    const data = createCtx();
    seedRun(data);
    data.documents.set("device", { projectId: "other", hikTransport: "localBridge" });
    expect(await handler(queueBridgeOperation)(data.ctx, { runId: "run", batch: 1, deviceId: "device", employeeId: "employee", cardNumber: "123", kind: "face" })).toBeNull();
    expect(data.ctx.runMutation).not.toHaveBeenCalled();
  });
  it("yeniden açma kilidi yalnız çalışan/bekleyen run için geçerlidir, bayat running çözülür", async () => {
    const data = createCtx();
    const ctx = data.ctx as unknown as QueryCtx;
    const projectId = "p" as Id<"projects">;
    seedRun(data, { startedAt: Date.now() - 25 * 60 * 60 * 1000, heartbeatAt: Date.now() });
    expect(await hasActiveDestructionRun(ctx, projectId)).toBe(true);
    seedRun(data, { startedAt: Date.now(), heartbeatAt: Date.now() - 31 * 60 * 1000 });
    expect(await hasActiveDestructionRun(ctx, projectId)).toBe(false);
    seedRun(data, { status: "waitingDevices" });
    expect(await hasActiveDestructionRun(ctx, projectId)).toBe(true);
    seedRun(data, { status: "completed" });
    expect(await hasActiveDestructionRun(ctx, projectId)).toBe(false);
  });
});


describe("cihaz tutanağı ve kesilen çalışma", () => {
  it("bekleyen cihazı başarı saymaz, yeniden kontrol planlar", async () => {
    const data = createCtx();
    seedRun(data, { status: "waitingDevices", pendingDeviceChecks: 1, pendingOpIds: ["op"], deviceCheckDeadline: Date.now() + 60_000 });
    data.documents.set("check", { _id: "check", targetTable: "biometricDestructionDeviceCheck", targetId: "run", newValue: { complete: false } });
    data.documents.set("op", { projectId: "p", deviceId: "device", status: "pending" });
    data.documents.set("device", { projectId: "p", hikTransport: "gateway" });
    await handler(checkDeviceOperations)(data.ctx, { runId: "run", attempt: 0 });
    expect(data.ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    expect(data.ctx.db.patch).toHaveBeenCalledWith("run", { newValue: expect.objectContaining({ deviceCheckAttempt: 1, pendingDeviceChecks: 1 }) });
  });
  it("başarısız, kayıp ve süresi dolmuş operasyonları ayrı sayar ve tutanağı bitirir", async () => {
    const data = createCtx();
    seedRun(data, { status: "waitingDevices", pendingDeviceChecks: 1, pendingOpIds: ["failed", "missing", "pending", "done"], deviceCheckDeadline: 0 });
    data.documents.set("check", { _id: "check", targetTable: "biometricDestructionDeviceCheck", targetId: "run", newValue: { complete: false } });
    data.documents.set("failed", { projectId: "p", status: "failed" });
    data.documents.set("pending", { projectId: "p", status: "pending" });
    data.documents.set("done", { projectId: "p", status: "done" });
    const args = { runId: "run", attempt: 0 };
    await handler(checkDeviceOperations)(data.ctx, args);
    expect(data.ctx.db.patch).toHaveBeenCalledWith("run", { newValue: expect.objectContaining({ status: "completed", deviceFailures: 1, deviceUnconfirmed: 2, pendingDeviceChecks: 0 }) });
    data.documents.set("check", { _id: "check", targetTable: "biometricDestructionDeviceCheck", targetId: "run", newValue: { complete: true } });
    data.ctx.db.patch.mockClear();
    await handler(checkDeviceOperations)(data.ctx, args);
    expect(data.ctx.db.patch).not.toHaveBeenCalled();
  });
  it("takılı çalışmayı hata olarak sonlandırır, silinmiş toplamları korur", async () => {
    const data = createCtx();
    seedRun(data, { heartbeatAt: 0, deletedFaces: 5 });
    await handler(watchRun)(data.ctx, { runId: "run" });
    expect(data.ctx.db.patch).toHaveBeenCalledWith("run", { newValue: expect.objectContaining({ status: "failed", deletedFaces: 5, deviceUnconfirmed: 1 }) });
    expect(data.ctx.db.delete).not.toHaveBeenCalled();
  });
});


describe("run başına sınırlı kontrol ve audit", () => {
  it("500 şablonda tek zincir açar ve 24 saatte 100 çağrının altında kalır", async () => {
    const data = createCtx();
    seedRun(data);
    for (let i = 0; i < 500; i++) {
      await handler(finishBatch)(data.ctx, { runId: "run", batch: i + 1, item, deviceOperations: 1, deviceFailures: 0, deviceUnconfirmed: 0, queuedOpIds: [`op-${i}`] });
    }
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(data.ctx.scheduler.runAfter.mock.calls.every(call => call[0] === 0)).toBe(true);
    const row = data.documents.get("run") as { newValue: ReturnType<typeof initialDestructionState> };
    expect(row.newValue.pendingOpIds).toHaveLength(500);
    // Empty project scan -> legacy employee scan -> waiting device chain.
    await handler(prepareBatch)(data.ctx, { runId: "run" });
    await handler(prepareBatch)(data.ctx, { runId: "run" });
    expect(data.ctx.scheduler.runAfter.mock.calls.filter(call => call[0] > 0)).toHaveLength(1);
    let elapsed = deviceCheckDelay(0); let calls = 0;
    const now = Date.now();
    const date = vi.spyOn(Date, "now");
    data.documents.set("device", { projectId: "p", hikTransport: "localBridge", hikLastSeenAt: now });
    data.tables.set("hikBridges", [{ lastSeenAt: now }]);
    for (let i = 0; i < 500; i++) data.documents.set(`op-${i}`, { projectId: "p", status: "pending", deviceId: "device" });
    try {
      while (elapsed <= DEVICE_WAIT_MS + 30 * 60_000) {
        date.mockReturnValue(now + elapsed);
        data.documents.set("device", { projectId: "p", hikTransport: "localBridge", hikLastSeenAt: now + elapsed });
        data.tables.set("hikBridges", [{ lastSeenAt: now + elapsed }]);
        await handler(checkDeviceOperations)(data.ctx, { runId: "run", attempt: calls });
        calls++;
        const current = data.documents.get("run") as typeof row;
        if (current.newValue.status === "completed") break;
        elapsed += deviceCheckDelay(calls);
      }
      expect(calls).toBe(51);
      expect(calls).toBeLessThanOrEqual(100);
      expect(calls).toBeGreaterThan(40);
      expect((data.documents.get("run") as typeof row).newValue).toMatchObject({ status: "completed", deviceUnconfirmed: 500 });
      expect(mocks.audit).toHaveBeenCalledTimes(1); // one final report, zero progress/device audits
    } finally { date.mockRestore(); }
  });
  it("kimlik sınırında tutanağı failed yapar ve tüm bekleyenleri doğrulanamayan sayar", async () => {
    const data = createCtx();
    seedRun(data, { pendingOpIds: Array.from({ length: MAX_PENDING_DEVICE_OPS }, (_, i) => `old-${i}`) });
    await handler(finishBatch)(data.ctx, { runId: "run", batch: 1, item, deviceOperations: 1, deviceFailures: 0, deviceUnconfirmed: 0, queuedOpIds: ["new"] });
    expect(data.ctx.db.patch).toHaveBeenCalledWith("run", { newValue: expect.objectContaining({ status: "failed", deviceUnconfirmed: MAX_PENDING_DEVICE_OPS + 1, pendingOpIds: [] }) });
    expect((data.documents.get("run") as { newValue: { pendingOpIds: string[] } }).newValue.pendingOpIds).toHaveLength(0);
  });
  it("çevrimdışı köprüde ilk kontrolde tamamlar, yeniden planlamaz", async () => {
    const data = createCtx();
    seedRun(data, { status: "waitingDevices", pendingOpIds: ["op"], pendingDeviceChecks: 1, deviceCheckDeadline: Date.now() + DEVICE_WAIT_MS });
    data.documents.set("op", { projectId: "p", status: "pending", deviceId: "device" });
    data.documents.set("device", { projectId: "p", hikTransport: "localBridge", hikLastSeenAt: 0 });
    await handler(checkDeviceOperations)(data.ctx, { runId: "run", attempt: 0 });
    expect(data.ctx.scheduler.runAfter).not.toHaveBeenCalled();
    expect(data.ctx.db.patch).toHaveBeenCalledWith("run", { newValue: expect.objectContaining({ status: "completed", deviceUnconfirmed: 1 }) });
  });
  it("başlangıç iki audit satırı, bitiş tek özet üretir", async () => {
    const data = createCtx();
    data.tables.set("projectPrivacySettings", [{ biometricEnabled: false }]);
    mocks.audit.mockImplementation(async (_ctx: unknown, entry: { targetTable: string; newValue: unknown }) => {
      if (entry.targetTable === "biometricDestructionRun") {
        const row = { _id: "run", projectId: "p", targetTable: entry.targetTable, newValue: entry.newValue };
        data.documents.set("run", row); data.tables.set("auditLog", [row]);
      }
    });
    await handler(startBiometricDestruction)(data.ctx, startArgs);
    expect(mocks.audit).toHaveBeenCalledTimes(2);
    await handler(prepareBatch)(data.ctx, { runId: "run" });
    await handler(prepareBatch)(data.ctx, { runId: "run" });
    expect(mocks.audit).toHaveBeenCalledTimes(3);
  });
  it("aynı kontrol teslimi ikinci zincir açmaz", async () => {
    const data = createCtx();
    seedRun(data, { status: "waitingDevices", pendingOpIds: ["op"], pendingDeviceChecks: 1, deviceCheckDeadline: Date.now() + DEVICE_WAIT_MS });
    data.documents.set("op", { projectId: "p", status: "pending", deviceId: "device" });
    data.documents.set("device", { projectId: "p", hikTransport: "gateway" });
    await handler(checkDeviceOperations)(data.ctx, { runId: "run", attempt: 0 });
    await handler(checkDeviceOperations)(data.ctx, { runId: "run", attempt: 0 });
    expect(data.ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });
  it("gateway oluşturma ve bitirme ara audit satırı üretmez", async () => {
    const data = createCtx(); seedRun(data);
    data.documents.set("device", { projectId: "p", brand: "hikvision", hikDevIndex: "d" });
    await handler(createGatewayOperation)(data.ctx, { runId: "run", batch: 1, deviceId: "device", hikDevIndex: "d", employeeId: "e", cardNumber: "123", kind: "face" });
    data.documents.set("gateway-op", { projectId: "p", attemptCount: 1 });
    await handler(finishGatewayOperation)(data.ctx, { runId: "run", opId: "gateway-op", ok: true });
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("projesiz eski şablonlar", () => {
  it("önizleme projesiz şablonları ayrı sayar", async () => {
    const data = createCtx();
    data.tables.set("employees", [{ _id: "employee", projectId: "p" }]);
    // Mock distinguishes index scopes to mirror the real indexed reads.
    data.ctx.db.query.mockImplementation((table: string) => {
      let index = "";
      const rows = () => table === "userProjects" ? [{ userId: "u", projectId: "p", role: "admin" }] : table === "employees" ? [{ _id: "employee" }] : index === "by_employee" && table === "employeeFaces" ? [{ employeeId: "employee", pictureStorageId: "file" }] : [];
      const query = { withIndex: (name?: string) => { index = name ?? ""; return query; }, order: () => query, take: async () => rows(), first: async () => null, paginate: async () => ({ page: rows(), continueCursor: "end", isDone: true }) };
      return query;
    });
    expect(await handler(previewBiometricDestruction)(data.ctx, { projectId: "p", kinds: ["face"] })).toMatchObject({ faceCount: 1, projectlessTemplateCount: 1 });
  });
  it("imha legacy aşamasında çalışanı doğrulayıp şablonu işleme alır", async () => {
    const data = createCtx();
    seedRun(data, { scan: "legacy", legacyEmployeeId: "employee" });
    data.documents.set("employee", { projectId: "p", cardNumber: "123" });
    data.tables.set("employeeFaces", [{ _id: "face", employeeId: "employee", addedAt: 5, pictureStorageId: "file" }]);
    await handler(prepareBatch)(data.ctx, { runId: "run" });
    expect(data.ctx.scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), expect.objectContaining({ item: expect.objectContaining({ faceId: "face", employeeId: "employee" }) }));
  });
  it("projesiz satırı yalnız çalışan hâlâ hedef projedeyse siler", async () => {
    for (const projectId of ["p", "other"]) {
      const data = createCtx(); seedRun(data);
      data.documents.set("employee", { projectId });
      data.documents.set("face", { _id: "face", employeeId: "employee", addedAt: 5, pictureStorageId: "file" });
      await handler(finishBatch)(data.ctx, { runId: "run", batch: 1, item, deviceOperations: 0, deviceFailures: 0, deviceUnconfirmed: 0, queuedOpIds: [] });
      expect(data.ctx.db.delete.mock.calls.length).toBe(projectId === "p" ? 1 : 0);
    }
  });
});
