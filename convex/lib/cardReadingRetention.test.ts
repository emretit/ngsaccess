import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { retentionBatchPlan, retentionCutoff, validRetentionDays } from "./cardReadingRetention";
import { upsertPrivacySettings } from "./privacySettings";

describe("kart okuma saklama planı", () => {
  it("süresiz varsayılanda kesim üretmez", () => expect(retentionCutoff(null, Date.now())).toBeNull());
  it.each([365, 1824, 3651, 1825.5, NaN, Infinity, -1, 0])("geçersiz süreyi reddeder: %s", days => {
    expect(validRetentionDays(days)).toBe(false);
    expect(() => retentionCutoff(days, Date.now())).toThrow();
  });
  it.each([1825, 3650, null])("sınırları ve süresizi kabul eder: %s", days => expect(validRetentionDays(days)).toBe(true));
  it("Türkiye gün sınırını UTC ISO olarak hesaplar", () => {
    expect(retentionCutoff(1825, Date.parse("2026-10-18T21:05:00Z"))).toBe("2021-10-19T21:00:00.000Z");
    expect(retentionCutoff(1825, Date.parse("2026-10-18T20:59:00Z"))).toBe("2021-10-18T21:00:00.000Z");
  });
  it("artık yıl ve 3650 günlük aralığı doğru hesaplar", () => {
    expect(retentionCutoff(1825, Date.parse("2024-03-01T09:00:00Z"))).toBe("2019-03-02T21:00:00.000Z");
    expect(retentionCutoff(3650, Date.parse("2026-10-19T09:00:00Z"))).toBe("2016-10-20T21:00:00.000Z");
  });
  it("200'lük batch devam eder, kısa batch durur ve 20 batch tavanında bırakır", () => {
    expect(retentionBatchPlan(200, 1)).toEqual({ continueRun: true, dailyLimitReached: false });
    expect(retentionBatchPlan(199, 1)).toEqual({ continueRun: false, dailyLimitReached: false });
    expect(retentionBatchPlan(0, 20)).toEqual({ continueRun: false, dailyLimitReached: false });
    expect(retentionBatchPlan(200, 20)).toEqual({ continueRun: false, dailyLimitReached: true });
  });
  it("süresize dönüş null patch ile yalnız saklama alanını temizler", async () => {
    const patch = vi.fn();
    const ctx = { db: { query: () => ({ withIndex: () => ({ first: async () => ({ _id: "privacy-a", aiMaskNames: false, cardReadingRetentionDays: 1825 }) }) }), patch } } as unknown as MutationCtx;
    await upsertPrivacySettings(ctx, "project-a" as Id<"projects">, { cardReadingRetentionDays: null });
    expect(patch).toHaveBeenCalledWith("privacy-a", { cardReadingRetentionDays: undefined, updatedAt: expect.any(String) });
    expect(Object.prototype.hasOwnProperty.call(patch.mock.calls[0][1], "cardReadingRetentionDays")).toBe(true);
    expect(patch.mock.calls[0][1]).not.toHaveProperty("aiMaskNames");
  });
});

const auth = vi.hoisted(() => ({ allowed: ["project-a"] }));
vi.mock("./auth", () => ({
  getProjectIdsForUser: async () => auth.allowed,
  // Bağlamda kullanıcı yoksa (sunucu bağlamı testleri) super_admin: izin kontrolü DB okumadan geçer.
  getCurrentUser: async (ctx: { user?: unknown }) => ctx.user ?? { _id: "admin", role: "super_admin" },
}));
vi.mock("./customFunctions", () => ({
  authedMutation: (definition: { handler: unknown }) => ({ _handler: definition.handler }),
  authedQuery: (definition: { handler: unknown }) => ({ _handler: definition.handler }),
}));

import { purgeExpiredCardReadings, purgeProjectBatch, setCardReadingRetention, setAssistantMasking, getAssistantContext, getAssistantPrivacy } from "../privacyRetention";

function handler(fn: unknown) {
  return (fn as { _handler: (ctx: MutationCtx, args: object) => Promise<unknown> })._handler;
}
function retentionContext({ days = 1825 as number | undefined, count = 200, allowed = true } = {}) {
  auth.allowed = allowed ? ["project-a"] : [];
  const deleted = vi.fn(); const patch = vi.fn(); const insert = vi.fn(); const schedule = vi.fn();
  const take = vi.fn(async () => Array.from({ length: count }, (_, n) => ({ _id: `reading-${n}` })));
  const compare = { eq: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis() };
  const page = { page: [{ projectId: "project-a", cardReadingRetentionDays: days }, { projectId: "project-b" }], isDone: true, continueCursor: "end" };
  const ctx = {
    user: { _id: "admin", role: "project_admin" },
    db: { query: (_table: string) => ({
      withIndex: (_name: string, range: (q: typeof compare) => unknown) => {
        range(compare);
        return { first: async () => ({ _id: "privacy-a", cardReadingRetentionDays: days, aiMaskNames: true }),
          take: _table === "userProjects" ? async () => auth.allowed.map(projectId => ({ projectId, userId: "admin", role: "admin" })) : take };
      },
      paginate: async () => page,
    }), delete: deleted, patch, insert }, scheduler: { runAfter: schedule },
  } as unknown as MutationCtx;
  return { ctx, deleted, patch, insert, schedule, take, compare };
}

describe("saklama handler sınırları", () => {
  it.each([365, 1824, 3651, 1825.5])("saklama mutation geçersiz süreyi yazmadan reddeder: %s", async days => {
    const { ctx, patch, insert } = retentionContext();
    await expect(handler(setCardReadingRetention)(ctx, { projectId: "project-a", days })).rejects.toThrow("1825–3650");
    expect(patch).not.toHaveBeenCalled(); expect(insert).not.toHaveBeenCalled();
  });
  it("proje izni olmayan yazmaları reddeder", async () => {
    const { ctx, patch, insert } = retentionContext({ allowed: false });
    await expect(handler(setCardReadingRetention)(ctx, { projectId: "project-a", days: 1825 })).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(handler(setAssistantMasking)(ctx, { projectId: "project-a", enabled: false })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(patch).not.toHaveBeenCalled(); expect(insert).not.toHaveBeenCalled();
  });
  it("asistan bağlamı ve gizlilik okumasında yabancı projeyi reddeder", async () => {
    const { ctx } = retentionContext({ allowed: false });
    await expect(handler(getAssistantContext)(ctx, { projectId: "foreign-project" })).rejects.toThrow("Bu projeye erişim yetkiniz yok.");
    await expect(handler(getAssistantPrivacy)(ctx, { projectId: "foreign-project" })).rejects.toThrow("Bu projeye erişim yetkiniz yok.");
  });
  it("sunucu bağlamı satır yokken maskelidir; kapalı ayarda eski adları korur", async () => {
    auth.allowed = ["project-a"];
    for (const { enabled, force } of [{ enabled: undefined, force: false }, { enabled: false, force: false }, { enabled: false, force: true }]) {
      const ctx = { db: { query: (table: string) => ({ withIndex: () => table === "projectPrivacySettings"
        ? { first: async () => enabled === undefined ? null : { aiMaskNames: enabled } }
        : { order: () => ({ take: async () => [{ projectId: "project-a", employeeId: "person-a", employeeName: "Ali Yılmaz", cardNo: "123", accessTime: "2026-10-19T06:00:00Z" }] }) },
      }) } } as unknown as MutationCtx;
      const context = await handler(getAssistantContext)(ctx, { projectId: "project-a", forceMaskNames: force });
      expect(context).toContain(enabled === false && !force ? "Ali Yılmaz" : "Personel 1");
      if (enabled === undefined || force) expect(context).not.toContain("Ali Yılmaz");
      expect(context).not.toContain("person-a");
    }
  });
  it("maskeleme değişikliği yalnız kendi alanını ve denetim kaydını yazar", async () => {
    const { ctx, patch, insert } = retentionContext();
    await handler(setAssistantMasking)(ctx, { projectId: "project-a", enabled: false });
    expect(patch).toHaveBeenCalledWith("privacy-a", { aiMaskNames: false, updatedAt: expect.any(String) });
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ newValue: { aiMaskNames: false } }));
  });
  it("süresiz ayarı yalnız kendi alanını temizleyerek ve audit ile kaydeder", async () => {
    const { ctx, patch, insert } = retentionContext();
    await handler(setCardReadingRetention)(ctx, { projectId: "project-a", days: null });
    expect(patch).toHaveBeenCalledWith("privacy-a", { cardReadingRetentionDays: undefined, updatedAt: expect.any(String) });
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ projectId: "project-a", newValue: { cardReadingRetentionDays: null } }));
  });
  it("batch yalnız index ile kesimden eski 200 kayıt alır ve devamını zamanlar", async () => {
    const { ctx, take, compare, deleted, schedule, insert } = retentionContext();
    await handler(purgeProjectBatch)(ctx, { projectId: "project-a", days: 1825, runAt: Date.parse("2026-10-19T08:00:00Z"), batch: 0, deleted: 0 });
    expect(take).toHaveBeenCalledWith(200);
    expect(compare.eq).toHaveBeenCalledWith("projectId", "project-a");
    expect(compare.lt).toHaveBeenCalledWith("accessTime", "2021-10-19T21:00:00.000Z");
    expect(deleted).toHaveBeenCalledTimes(200);
    expect(schedule).toHaveBeenCalledWith(0, expect.anything(), expect.objectContaining({ batch: 1, deleted: 200 }));
    expect(insert).not.toHaveBeenCalled();
  });
  it("günlük tavanında durur ve toplamı kullanıcı olmadan denetim kaydına yazar", async () => {
    const { ctx, schedule, insert } = retentionContext();
    await handler(purgeProjectBatch)(ctx, { projectId: "project-a", days: 1825, runAt: Date.now(), batch: 19, deleted: 3800 });
    expect(schedule).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ userId: undefined, projectId: "project-a", newValue: expect.objectContaining({ deleted: 4000, dailyLimitReached: true }) }));
  });
  it("süre değişince eski zincir silmeden durur ve raporlar", async () => {
    const { ctx, deleted, insert } = retentionContext({ days: 2000 });
    await handler(purgeProjectBatch)(ctx, { projectId: "project-a", days: 1825, runAt: Date.now(), batch: 1, deleted: 200 });
    expect(deleted).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ newValue: expect.objectContaining({ deleted: 200, stoppedBySettingsChange: true }) }));
  });
  it("süresiz projeyi dağıtım sırasında atlar", async () => {
    const { ctx, schedule } = retentionContext();
    await handler(purgeExpiredCardReadings)(ctx, {});
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(0, expect.anything(), expect.objectContaining({ projectId: "project-a" }));
  });
});
