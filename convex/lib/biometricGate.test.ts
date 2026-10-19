import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { assertBiometricAllowed, biometricPayloadProject, biometricReason, isBiometricAddition } from "./biometricGate";

const destruction = vi.hoisted(() => ({ active: true }));
vi.mock("./biometricDestructionState", () => ({ hasActiveDestructionRun: vi.fn(async () => destruction.active) }));
vi.mock("./customFunctions", () => ({ adminMutation: (config: unknown) => config, adminQuery: (config: unknown) => config, authedQuery: (config: unknown) => config }));
vi.mock("./auth", () => ({ getProjectIdsForUser: vi.fn(async () => ["project"]), requireEmployeeAccess: vi.fn() }));

const projectId = "project" as Id<"projects">;
function context(row: { biometricEnabled?: boolean; _id?: string } | null) {
  const first = vi.fn().mockResolvedValue(row);
  const query = vi.fn().mockReturnValue({ withIndex: vi.fn().mockReturnValue({ first }) });
  return { ctx: { db: { query } } as unknown as QueryCtx, query };
}

describe("biyometri kapısı", () => {
  it("açık projede izin verir", async () => {
    await expect(assertBiometricAllowed(context({ biometricEnabled: true }).ctx, projectId)).resolves.toBeUndefined();
  });
  it("kapalı projede kodlu Türkçe hata verir", async () => {
    try { await assertBiometricAllowed(context({ biometricEnabled: false }).ctx, projectId); throw new Error("Kapı reddetmedi"); }
    catch (error: unknown) {
      expect(error).toBeInstanceOf(ConvexError);
      if (error instanceof ConvexError) expect(error.data).toMatchObject({ code: "BIOMETRIC_DISABLED", message: expect.stringContaining("kapalı") });
    }
  });
  it("satır yoksa eski proje açık kalır", async () => {
    await expect(assertBiometricAllowed(context(null).ctx, projectId)).resolves.toBeUndefined();
  });
  it("proje yoksa eski davranışı korur ve sorgulamaz", async () => {
    const { ctx, query } = context(null);
    await expect(assertBiometricAllowed(ctx, undefined)).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });
  it("gerekçe kırpılır, açma zorunlu, kapatma isteğe bağlıdır", () => {
    expect(biometricReason(true, "  Kritik alan  ")).toBe("Kritik alan");
    expect(biometricReason(false, undefined)).toBe("");
    for (const value of [undefined, " ", "ab", "a".repeat(501)]) expect(() => biometricReason(true, value)).toThrow();
    expect(() => biometricReason(false, "a".repeat(501))).toThrow();
  });
  it("kuyrukta bildirilen proje yerine çalışanın güncel projesini çözer", async () => {
    const employeeId = "employee" as Id<"employees">;
    const get = vi.fn().mockResolvedValue({ projectId });
    const normalizeId = vi.fn().mockReturnValue(employeeId);
    const ctx = { db: { get, normalizeId } } as unknown as QueryCtx;
    await expect(biometricPayloadProject(ctx, { employeeId, projectId: "yanlış-proje" })).resolves.toBe(projectId);
    expect(get).toHaveBeenCalledWith(employeeId);
    for (const payload of [null, {}, { employeeId: 1 }]) await expect(biometricPayloadProject(ctx, payload)).resolves.toBeUndefined();
    normalizeId.mockReturnValue(null);
    await expect(biometricPayloadProject(ctx, { employeeId: "geçersiz" })).resolves.toBeUndefined();
  });
  it("silme işlemleri biyometrik ekleme kapısından geçmez", () => {
    expect(isBiometricAddition("addFace")).toBe(true);
    expect(isBiometricAddition("addFingerprint")).toBe(true);
    for (const op of ["deleteFace", "deleteFingerprint", "removeFace", "removeFingerprint", "addCard"]) expect(isBiometricAddition(op)).toBe(false);
  });
});

describe("biyometri yönetimi / imha kilidi", () => {
  it("aktif imha sırasında açma reddedilir, kapatma kilitlenmez", async () => {
    const { setBiometricModule } = await import("../privacyBiometric");
    const { handler } = setBiometricModule as unknown as {
      handler: (ctx: MutationCtx & { user: Doc<"users"> }, args: { projectId: Id<"projects">; enabled: boolean; reason?: string }) => Promise<null>;
    };
    const fixture = context({ biometricEnabled: false });
    const ctx = { ...fixture.ctx, user: { _id: "admin", role: "super_admin" } } as unknown as MutationCtx & { user: Doc<"users"> };
    destruction.active = true;
    await expect(handler(ctx, { projectId, enabled: true, reason: "Kritik alan" })).rejects.toMatchObject({ data: { code: "BIOMETRIC_DESTRUCTION_ACTIVE" } });
    await expect(handler(ctx, { projectId, enabled: false })).resolves.toBeNull();
    const open = context({ biometricEnabled: true, _id: "settings" });
    const patch = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockResolvedValue("audit");
    const disablingCtx = { ...ctx, db: { ...open.ctx.db, patch, insert } } as unknown as MutationCtx & { user: Doc<"users"> };
    await expect(handler(disablingCtx, { projectId, enabled: false })).resolves.toBeNull();
    expect(patch).toHaveBeenCalledWith("settings", expect.objectContaining({ biometricEnabled: false }));
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ newValue: expect.objectContaining({ biometricEnabled: false }) }));
  });
  it("satırsız açık projede gerekçeyi ve denetim izini kaydeder", async () => {
    const { setBiometricModule } = await import("../privacyBiometric");
    const { handler } = setBiometricModule as unknown as {
      handler: (ctx: MutationCtx, args: { projectId: Id<"projects">; enabled: boolean; reason: string }) => Promise<null>;
    };
    destruction.active = false;
    const fixture = context(null);
    const insert = vi.fn().mockResolvedValue("new-row");
    const ctx = { ...fixture.ctx, user: { _id: "admin" }, db: { ...fixture.ctx.db, insert } } as unknown as MutationCtx;
    await handler(ctx, { projectId, enabled: true, reason: "  Kritik alan  " });
    expect(insert).toHaveBeenCalledWith("projectPrivacySettings", expect.objectContaining({ biometricEnabled: true, biometricReason: "Kritik alan" }));
    expect(insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ newValue: expect.objectContaining({ biometricReason: "Kritik alan" }) }));
  });

});
