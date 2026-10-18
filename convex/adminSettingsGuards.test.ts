import { describe, expect, it, vi } from "vitest";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import { updateRole } from "./users";
import { upsertGeneral } from "./settings";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { toPatch } from "./lib/nullablePatch";
import { membershipChanged, linkedCountLabel, projectDeletionBlockingTables, projectDeletionBlockers, projectDeletionCleanupTables, projectDeletionError, reportSchedulePayload, userProtectionError } from "./lib/adminGuards";

const change = { isSelf: false, isSuperAdmin: true, removesSuperAdmin: true, adminCount: 2, deleting: false };

describe("ADM-03 kullanıcı koruması", () => {
  it("son süper admin düşürülemez veya silinemez", () => {
    expect(userProtectionError({ ...change, adminCount: 1 })).toContain("son süper adminin rolü");
    expect(userProtectionError({ ...change, adminCount: 1, deleting: true })).toContain("son süper admin silinemez");
  });
  it("ikinci admin olsa da kendini düşürme ve silme engellenir", () => {
    expect(userProtectionError({ ...change, isSelf: true })).toBe("Kendi rolünüzü düşüremezsiniz");
    expect(userProtectionError({ ...change, isSelf: true, deleting: true })).toBe("Kendi hesabınızı silemezsiniz");
  });
  it("kendi rolünü korumaya ve başka admini yönetmeye izin verir", () => {
    expect(userProtectionError({ ...change, isSelf: true, removesSuperAdmin: false })).toBeNull();
    expect(userProtectionError(change)).toBeNull();
    expect(userProtectionError({ ...change, deleting: true })).toBeNull();
    expect(userProtectionError({ ...change, isSuperAdmin: false, adminCount: 0 })).toBeNull();
  });
});

describe("ADM-20 bağlı proje kayıtları", () => {
  it("boş proje için engel üretmez", () => {
    expect(linkedCountLabel(0, "cihaz")).toBeNull();
    expect(projectDeletionError([])).toBeNull();
  });
  it("yalnız ayar, üyelik ve denetim geçmişi olan proje silinebilir", () => {
    const counts = Object.fromEntries(projectDeletionCleanupTables.map((table) => [table, 1]));
    const blockers = projectDeletionBlockers({ ...counts, auditLog: 500 });
    expect(blockers).toEqual([]);
    expect(projectDeletionError(blockers)).toBeNull();
    expect(projectDeletionCleanupTables).toContain("userProjects");
    expect(projectDeletionCleanupTables).toContain("generalSettings");
    expect(projectDeletionCleanupTables).toContain("chatConversations");
    expect(projectDeletionCleanupTables).toContain("invites");
    expect(projectDeletionCleanupTables).not.toContain("auditLog");
  });
  it("personeli olan proje yalnız iş verisini açıklayarak engellenir", () => {
    const blockers = projectDeletionBlockers({ employees: 1, userProjects: 1, generalSettings: 1, auditLog: 10 });
    expect(blockers).toEqual(["1 personel"]);
    expect(projectDeletionError(blockers)).toContain("1 personel var");
    expect(projectDeletionError(blockers)).toContain("pasife alabilirsiniz");
  });
  it("tüm iş tabloları engeller; türetilmiş cihaz ve personel bağlantıları engellemez", () => {
    for (const { table, label } of projectDeletionBlockingTables) {
      expect(projectDeletionBlockers({ [table]: 101 })).toEqual([`en az 101 ${label}`]);
      expect(projectDeletionCleanupTables).not.toContain(table);
    }
    expect(projectDeletionBlockers({ employeeAuth: 1, idePanelUsers: 1, hikPendingOperations: 1, idePendingOperations: 1 })).toEqual([]);
  });
  it("bağlı kayıtların sayısını ve çözümü açıklar", () => {
    expect(projectDeletionError(["12 personel", "3 cihaz"]))
      .toContain("12 personel, 3 cihaz var; önce bunları taşıyın veya silin");
  });
  it("sınırlanmış sayımı kesin toplam diye sunmaz", () => {
    expect(linkedCountLabel(100, "personel")).toBe("100 personel");
    expect(linkedCountLabel(101, "personel")).toBe("en az 101 personel");
  });
});

describe("ADM-11 rapor zamanlaması", () => {
  it("gizli e-posta boşken kapatılabilir", () => {
    expect(reportSchedulePayload("sgk", "  ", false)).toEqual({ reportType: "sgk", email: "", enabled: false });
  });
  it("açarken e-posta ister ve adresi temizler", () => {
    expect(() => reportSchedulePayload("sgk", "  ", true)).toThrow("E-posta adresi girin");
    expect(reportSchedulePayload("sgk", " rapor@firma.com ", true).email).toBe("rapor@firma.com");
  });
});

describe("C3 membership snapshot", () => {
  const a = "project-a" as Id<"projects">;
  const b = "project-b" as Id<"projects">;
  it("accepts reordered and duplicated membership sets", () => {
    expect(membershipChanged([a, b, a], [b, a])).toBe(false);
    expect(membershipChanged([], [])).toBe(false);
  });
  it("rejects additions, removals and substitutions", () => {
    expect(membershipChanged([a, b], [a])).toBe(true);
    expect(membershipChanged([a], [a, b])).toBe(true);
    expect(membershipChanged([b], [a])).toBe(true);
    expect(membershipChanged([a], [])).toBe(true);
    expect(membershipChanged([], [a])).toBe(true);
  });
  it("preserves legacy behavior when no snapshot was supplied", () => {
    expect(membershipChanged([a, b], undefined)).toBe(false);
  });
});

describe("C3 general settings partial patch", () => {
  it("preserves remote fields and interprets null as an explicit clear", () => {
    const live = { companyName: "Uzak şirket", email: "remote@example.com", phone: "old", darkMode: true };
    const patch = toPatch({ phone: "new", email: undefined });
    expect({ ...live, ...patch }).toEqual({ ...live, phone: "new" });
    expect(toPatch({ phone: null, darkMode: false })).toEqual({ phone: undefined, darkMode: false });
  });
  it("keeps all fields supplied by a legacy full payload", () => {
    expect(toPatch({ companyName: "Şirket", email: null, phone: "123", notificationsEnabled: false }))
      .toEqual({ companyName: "Şirket", email: undefined, phone: "123", notificationsEnabled: false });
  });
});

// Exercise the actual transaction handlers without external auth or database writes.
vi.mock("./lib/customFunctions", () => {
  const register = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return { superAdminMutation: register, adminMutation: register, authedMutation: register,
    optionalAuthQuery: register, authedQuery: register, adminQuery: register, superAdminQuery: register };
});
vi.mock("./lib/projectScope", () => ({ resolveProjectScope: async () => ["project-a"] }));

const roleHandler = (updateRole as unknown as {
  _handler: (ctx: MutationCtx, args: FunctionArgs<typeof api.users.updateRole>) => Promise<null>;
})._handler;
const generalHandler = (upsertGeneral as unknown as {
  _handler: (ctx: MutationCtx, args: FunctionArgs<typeof api.settings.upsertGeneral>) => Promise<FunctionReturnType<typeof api.settings.upsertGeneral>>;
})._handler;

describe("C3 transaction contracts", () => {
  it("rejects stale membership snapshots before any role or membership write", async () => {
    const patch = vi.fn(); const insert = vi.fn(); const remove = vi.fn();
    const query = { withIndex: () => query, collect: async () => [{ projectId: "project-b" }] };
    const ctx = { user: { _id: "actor" }, db: {
      get: async () => ({ role: "project_user" }), query: () => query,
      patch, insert, delete: remove,
    } } as unknown as MutationCtx;
    await expect(roleHandler(ctx, { userId: "target" as Id<"users">, role: "project_admin",
      projectIds: [], expectedProjectIds: ["project-a" as Id<"projects">] }))
      .rejects.toMatchObject({ data: { code: "MEMBERSHIP_CHANGED" } });
    expect(patch).not.toHaveBeenCalled(); expect(insert).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
    await expect(roleHandler(ctx, { userId: "target" as Id<"users">, role: "project_admin" })).resolves.toBeNull();
    expect(patch).toHaveBeenCalledOnce();
  });
  it("does not reintroduce companyName on a phone-only settings update", async () => {
    const patch = vi.fn();
    const query = { withIndex: () => query, first: async () => ({ _id: "settings" }) };
    const ctx = { db: { query: () => query, patch } } as unknown as MutationCtx;
    await generalHandler(ctx, { projectId: "project-a" as Id<"projects">, phone: "456" });
    expect(patch).toHaveBeenCalledWith("settings", { projectId: "project-a", phone: "456", updatedAt: expect.any(String) });
    await generalHandler(ctx, { projectId: "project-a" as Id<"projects">, phone: null, companyName: " Şirket " });
    expect(patch).toHaveBeenLastCalledWith("settings", { projectId: "project-a", phone: undefined, companyName: "Şirket", updatedAt: expect.any(String) });
  });
});
