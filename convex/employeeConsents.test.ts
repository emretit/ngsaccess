import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const auth = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
// Yalnız oturum çözümlemesini değiştir: adminMutation, çalışan kapsamı,
// biyometri kapısı ve audit yazımı gerçek uygulama kodundan çalışır.
vi.mock("./lib/auth", async importOriginal => ({
  ...await importOriginal<typeof import("./lib/auth")>(),
  ...auth,
}));
import { grant, listForEmployee, revoke } from "./employeeConsents";

const userId = "user-a" as Id<"users">;
const employeeId = "employee-a" as Id<"employees">;
const projectId = "project-a" as Id<"projects">;
const otherProjectId = "project-b" as Id<"projects">;
const consentId = "consent-a" as Id<"employeeConsents">;

function context(options: {
  project?: Id<"projects">;
  biometricEnabled?: boolean;
  consentType?: Doc<"employeeConsents">["consentType"];
  allowedProjects?: Id<"projects">[];
} = {}) {
  const consent = {
    _id: consentId, employeeId, consentType: options.consentType ?? "card",
    grantedAt: "2026-10-19T06:00:00Z",
  };
  const insert = vi.fn(async (table: string) => table === "employeeConsents" ? consentId : "audit-a");
  const patch = vi.fn(async () => undefined);
  const query = vi.fn((table: string) => {
    const chain = {
      withIndex: () => chain,
      filter: () => chain,
      first: async () => table === "projectPrivacySettings" ? { biometricEnabled: options.biometricEnabled ?? true } : null,
      collect: async () => table === "userProjects"
        ? (options.allowedProjects ?? [projectId]).map(projectId => ({ userId, projectId }))
        : [consent],
    };
    return chain;
  });
  const get = vi.fn(async (id: string) => id === consentId ? consent : { _id: employeeId, projectId: options.project });
  const ctx = { db: { get, query, insert, patch } } as unknown as MutationCtx;
  return { ctx, insert, patch, get, query, consent };
}

// Registered function'ın _handler'ı customMutation input/auth sarmalayıcısını
// da çalıştırır; customFunctions mock'lanmaz (syncIssuesAuth.test.ts kalıbı).
function invoke<TArgs extends object>(registered: unknown, ctx: MutationCtx, args: TArgs) {
  return (registered as { _handler: (ctx: MutationCtx, args: TArgs) => Promise<unknown> })._handler(ctx, args);
}

function signIn(role: Doc<"users">["role"]) {
  auth.getCurrentUser.mockResolvedValue({ _id: userId, role });
}

beforeEach(() => vi.resetAllMocks());

describe("KVKK rıza mutation yetkisi", () => {
  it.each(["card", "photo", "biometric_face", "biometric_fingerprint"] as const)("project_user %s grant/revoke çağrısı hiçbir yazım yapmadan reddedilir", async consentType => {
    signIn("project_user");
    const state = context({ project: projectId, consentType });
    await expect(invoke(grant, state.ctx, { employeeId, consentType })).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(invoke(revoke, state.ctx, { id: consentId })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(state.insert).not.toHaveBeenCalled(); // Rıza ve audit insert'leri.
    expect(state.patch).not.toHaveBeenCalled();
    expect(state.get).not.toHaveBeenCalled(); // Handler'a bile girilmez.
    expect(state.query).not.toHaveBeenCalled();
  });

  it("project_user kendi projesinin rızalarını listeleyebilir", async () => {
    signIn("project_user");
    const state = context({ project: projectId });
    await expect(invoke(listForEmployee, state.ctx, { employeeId })).resolves.toEqual([state.consent]);
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.patch).not.toHaveBeenCalled();
  });

  it.each(["project_admin", "super_admin"] as const)("%s kendi projesinde grant ve revoke yapar ve audit yazar", async role => {
    signIn(role);
    const state = context({ project: projectId });
    await expect(invoke(grant, state.ctx, { employeeId, consentType: "card" })).resolves.toBe(consentId);
    await expect(invoke(revoke, state.ctx, { id: consentId })).resolves.toBeUndefined();
    expect(state.insert).toHaveBeenCalledWith("employeeConsents", expect.objectContaining({ employeeId, grantedBy: userId }));
    expect(state.patch).toHaveBeenCalledWith(consentId, { revokedAt: expect.any(String) });
    expect(state.insert.mock.calls.filter(([table]) => table === "auditLog")).toHaveLength(2);
  });

  it.each([
    { label: "başka proje", project: otherProjectId, allowedProjects: [projectId] },
    { label: "orphan", project: undefined, allowedProjects: [projectId] },
    { label: "boş üyelik", project: projectId, allowedProjects: [] },
  ])("project_admin $label çalışanında grant/revoke yapamaz", async options => {
    signIn("project_admin");
    const state = context(options);
    await expect(invoke(grant, state.ctx, { employeeId, consentType: "card" })).rejects.toThrow("Bu çalışanın projesine erişim yetkiniz yok");
    await expect(invoke(revoke, state.ctx, { id: consentId })).rejects.toThrow("Bu çalışanın projesine erişim yetkiniz yok");
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.patch).not.toHaveBeenCalled();
  });

  it("super_admin orphan çalışanda grant/revoke yapabilir", async () => {
    signIn("super_admin");
    const state = context();
    await expect(invoke(grant, state.ctx, { employeeId, consentType: "biometric_face" })).resolves.toBe(consentId);
    await expect(invoke(revoke, state.ctx, { id: consentId })).resolves.toBeUndefined();
    expect(state.patch).toHaveBeenCalledOnce();
  });

  it.each(["project_admin", "super_admin"] as const)("%s için kapalı modülde biyometrik grant yasak, revoke serbest", async role => {
    signIn(role);
    for (const consentType of ["biometric_face", "biometric_fingerprint"] as const) {
      const state = context({ project: projectId, biometricEnabled: false, consentType });
      await expect(invoke(grant, state.ctx, { employeeId, consentType })).rejects.toThrow("biyometri modülü kapalı");
      expect(state.insert).not.toHaveBeenCalled();
      expect(state.patch).not.toHaveBeenCalled();
      await expect(invoke(revoke, state.ctx, { id: consentId })).resolves.toBeUndefined();
      expect(state.patch).toHaveBeenCalledOnce();
      expect(state.insert).toHaveBeenCalledWith("auditLog", expect.objectContaining({ action: "update" }));
    }
  });

  it.each(["biometric_face", "biometric_fingerprint"] as const)("açık modülde project_admin %s rızası alabilir", async consentType => {
    signIn("project_admin");
    const state = context({ project: projectId, biometricEnabled: true });
    await expect(invoke(grant, state.ctx, { employeeId, consentType })).resolves.toBe(consentId);
    expect(state.insert).toHaveBeenCalledWith("employeeConsents", expect.objectContaining({ consentType }));
  });
});
