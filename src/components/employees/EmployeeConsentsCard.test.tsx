vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => mocks.permissions ? mocks.permissions.includes(permission) : mocks.role === "project_admin" || mocks.role === "super_admin", loading: false }) }));
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ConfirmDestructiveProps } from "@/components/shared/ConfirmDestructive";
import { EmployeeConsentsCard } from "./EmployeeConsentsCard";

const mocks = vi.hoisted(() => ({
  permissions: null as string[] | null,
  role: "project_admin" as string | undefined,
  enabled: false, consents: [] as { _id: string; consentType: string; grantedAt: string; documentStorageId?: string; revokedAt?: string }[],
  states: [] as unknown[], cursor: 0, buttons: [] as { onClick?: () => unknown; disabled?: boolean; "aria-label"?: string; children?: unknown }[],
  confirm: null as ConfirmDestructiveProps | null,
  document: { storageId: undefined as string | undefined, pending: false, error: undefined as string | undefined, reset: vi.fn(), upload: vi.fn() },
  enrollments: [] as unknown[],
  query: vi.fn(),
  grant: vi.fn(), revoke: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: mocks.role } }) }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [mocks.states[index], (next: unknown) => { mocks.states[index] = next; }];
  } };
});
vi.mock("./hooks/useConsentDocumentUpload", () => ({ useConsentDocumentUpload: () => mocks.document }));
vi.mock("convex/react", () => ({
  useConvex: () => ({ query: mocks.query }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => getFunctionName(ref).startsWith("fingerprintEnrollment:") ? args === "skip" ? undefined : { enrollments: mocks.enrollments } : getFunctionName(ref).includes("getEmployeeBiometricModule") ? { enabled: mocks.enabled } : mocks.consents,
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":grant") ? mocks.grant : mocks.revoke,
}));
vi.mock("@/components/ui/button", () => ({ Button: (props: { children?: ReactNode; onClick?: () => unknown; disabled?: boolean; "aria-label"?: string }) => {
  mocks.buttons.push(props); return <button disabled={props.disabled} aria-label={props["aria-label"]}>{props.children}</button>;
} }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogFooter: Part, DialogHeader: Part, DialogTitle: Part };
});
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: (props: ConfirmDestructiveProps) => { mocks.confirm = props; return null; } }));
vi.mock("@/lib/notify", () => ({ notify: { error: mocks.error, success: mocks.success } }));
const employeeId = "employee-a" as Id<"employees">;
function render() {
  mocks.cursor = 0; mocks.buttons = [];
  return renderToStaticMarkup(<MemoryRouter><EmployeeConsentsCard employeeId={employeeId} /></MemoryRouter>);
}
beforeEach(() => {
  mocks.permissions = null;
  vi.clearAllMocks(); mocks.enrollments = []; mocks.role = "project_admin"; mocks.enabled = false; mocks.consents = []; mocks.states = []; mocks.confirm = null; mocks.document.pending = false; mocks.document.error = undefined; mocks.document.storageId = undefined;
});

describe("çalışan rıza kartı", () => {
  it.each(["project_user", undefined])("%s için liste görünür, yönetim düğmeleri ve akışları render edilmez", (role) => {
    mocks.role = role;
    mocks.consents = [{ _id: "consent-a", consentType: "biometric_face", grantedAt: "2026-10-19T06:00:00Z" }];
    // Rol değişse bile önceden açılmış diyalog/onay arayüzde kalmamalı.
    mocks.states = [{ id: "consent-a", label: "Yüz tanıma" }, "photo", "eski not", false];
    const html = render();
    expect(html).toContain("KVKK rızaları");
    expect(html).toContain("Yüz tanıma");
    expect(html).toContain("Aktif");
    expect(html).toContain("Alındı:");
    expect(html).toContain("19.10.2026 09:00");
    expect(html).not.toContain("Rıza Kaydı");
    expect(html).not.toContain("Rıza al");
    expect(html).not.toContain("İptal");
    expect(mocks.buttons.filter(button => button["aria-label"]?.includes("rızası"))).toHaveLength(0);
    expect(mocks.confirm).toBeNull();
    expect(mocks.grant).not.toHaveBeenCalled();
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it.each(["super_admin", "project_admin"])("%s için rıza alma ve iptal düğmeleri görünür", (role) => {
    mocks.role = role;
    mocks.consents = [{ _id: "consent-a", consentType: "biometric_face", grantedAt: "2026-10-19T06:00:00Z" }];
    render();
    expect(mocks.buttons.some(button => button["aria-label"] === "Yüz tanıma rızasını iptal et")).toBe(true);
    expect(mocks.buttons.some(button => button["aria-label"] === "Fotoğraf rızası al")).toBe(true);
    expect(mocks.confirm).not.toBeNull();
  });
  it("kapalı modülde biyometri nötr, ayar bağlantılı ve rıza düğmesizdir", () => {
    const html = render();
    expect(html.match(/>Kapalı</g)).toHaveLength(2);
    expect(html).toContain('/settings?tab=privacy');
    expect(html).toContain("Ayarlar › Gizlilik ve KVKK");
    expect(html).not.toContain("destructive");
    for (const label of ["Yüz tanıma", "Parmak izi", "Kart verisi"]) expect(mocks.buttons.find(button => button["aria-label"] === `${label} rızası al`)).toBeUndefined();
    expect(mocks.buttons.find(button => button["aria-label"] === "Fotoğraf rızası al")?.disabled).toBe(false);
    expect(html).toContain("İsteğe bağlı");
  });
  it("kart satırı yalnız eski aktif kayıtta görünür", () => {
    expect(render()).not.toContain('font-medium">Kart verisi');
    mocks.consents = [{ _id: "card-a", consentType: "card", grantedAt: "2026-10-19T06:00:00Z" }];
    expect(render()).toContain('font-medium">Kart verisi');
    expect(mocks.buttons.some(button => button["aria-label"] === "Kart verisi rızasını iptal et")).toBe(true);
    mocks.consents[0].revokedAt = "2026-10-20";
    expect(render()).not.toContain('font-medium">Kart verisi');
  });
  it("belge yalnız yetkili yöneticiye ve bağlıysa görünür", async () => {
    mocks.consents = [{ _id: "consent-a", consentType: "photo", grantedAt: "2026-10-19T06:00:00Z", documentStorageId: "storage-a" }];
    expect(render()).toContain("Belgeyi aç");
    const tab = { location: { href: "" }, close: vi.fn(), opener: {} };
    const open = vi.fn(() => tab);
    vi.stubGlobal("window", { open });
    mocks.query.mockResolvedValueOnce("https://example.test/signed");
    await mocks.buttons.find(button => button.children === "Belgeyi aç")?.onClick?.();
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { id: "consent-a" });
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.location.href).toBe("https://example.test/signed");
    expect(tab.opener).toBeNull();
    vi.unstubAllGlobals();
    mocks.role = "project_user";
    expect(render()).not.toContain("Belgeyi aç");
  });
  it("belge yüklenirken kaydet kapalı, yükleme ve hata durumu erişilebilirdir", () => {
    mocks.document.pending = true;
    expect(render()).toContain('role="status"');
    expect(mocks.buttons.find(button => button.children === "Rızayı kaydet")?.disabled).toBe(true);
    mocks.document.pending = false;
    mocks.document.error = "Yükleme başarısız";
    expect(render()).toContain('role="alert"');
  });
  it("parmak izi iptalinde cihaz silme etkisi açıklanır", async () => {
    mocks.consents = [{ _id: "fp-a", consentType: "biometric_fingerprint", grantedAt: "2026-10-19T06:00:00Z" }];
    render();
    await mocks.buttons.find(button => button["aria-label"] === "Parmak izi rızasını iptal et")?.onClick?.();
    render();
    expect(mocks.confirm?.effects).toEqual(["Cihazlardaki parmak izi kayıtları da silinir."]);
  });
  it("açık modülde biyometrik rıza açılır ve not etiketi alanla bağlıdır", () => {
    mocks.enabled = true;
    const html = render();
    expect(mocks.buttons.find(button => button["aria-label"] === "Yüz tanıma rızası al")?.disabled).toBe(false);
    const label = html.match(/<label for="([^"]+)"/);
    expect(label?.[1]).toBeDefined();
    expect(html).toContain(`id="${label?.[1]}"`);
  });
  it("ilk iptal tıklaması mutation çağırmaz, onaydan sonra iptal eder", async () => {
    mocks.consents = [{ _id: "consent-a", consentType: "biometric_face", grantedAt: "2026-10-19T06:00:00Z" }];
    render();
    await mocks.buttons.find(button => button["aria-label"] === "Yüz tanıma rızasını iptal et")?.onClick?.();
    expect(mocks.revoke).not.toHaveBeenCalled();
    render();
    expect(mocks.confirm?.open).toBe(true);
    expect(mocks.confirm?.effects.join(" ")).toContain("geçmiş korunur");
    await mocks.confirm?.onConfirm();
    expect(mocks.revoke).toHaveBeenCalledWith({ id: "consent-a" });
  });
  it("grant hatasını ham message yerine notify'a nesne olarak iletir", async () => {
    mocks.enabled = true;
    render();
    await mocks.buttons.find(button => button["aria-label"] === "Yüz tanıma rızası al")?.onClick?.();
    render();
    const error = new ConvexError({ code: "BIOMETRIC_DISABLED", message: "Biyometri modülü kapalı." });
    mocks.grant.mockRejectedValueOnce(error);
    await mocks.buttons.find(button => typeof button.onClick === "function" && button["aria-label"] === undefined && button.disabled === false && button.children === "Rızayı kaydet")?.onClick?.();
    expect(mocks.error).toHaveBeenCalledWith("Rıza alınamadı", error);
    expect(mocks.states[1]).toBe("biometric_face");
    expect(mocks.document.reset).toHaveBeenCalledOnce();
  });
});

it("belge isteğe bağlıdır ve yüklenen belge grant payloadına eklenir", async () => {
  mocks.document.storageId = "storage-a";
  render();
  await mocks.buttons.find(button => button["aria-label"] === "Fotoğraf rızası al")?.onClick?.();
  render();
  await mocks.buttons.find(button => button.children === "Rızayı kaydet")?.onClick?.();
  expect(mocks.grant).toHaveBeenCalledWith({ employeeId, consentType: "photo", documentStorageId: "storage-a", notes: undefined });
});

it("açık modülde eksik biyometri rızası nötrdür ve belgesiz satırda belge düğmesi yoktur", () => {
  mocks.enabled = true;
  const html = render();
  expect(html.match(/>Rıza yok</g)).toHaveLength(2);
  expect(html).not.toContain("destructive");
  expect(html).not.toContain("Belgeyi aç");
});

 it.each([null, "error"])("belge URL sonucu %s olduğunda önceden açılan sekme kapanır", async result => {
  mocks.consents = [{ _id: "consent-a", consentType: "photo", grantedAt: "2026-10-19T06:00:00Z", documentStorageId: "storage-a" }];
  const tab = { location: { href: "" }, close: vi.fn(), opener: null };
  const open = vi.fn(() => tab);
  vi.stubGlobal("window", { open });
  let settle: ((url: string | null) => void) | undefined;
  if (result === "error") mocks.query.mockRejectedValueOnce(new Error("network"));
  else mocks.query.mockImplementationOnce(() => new Promise<string | null>(resolve => { settle = resolve; }));
  render();
  const pending = mocks.buttons.find(button => button.children === "Belgeyi aç")?.onClick?.();
  expect(open).toHaveBeenCalledWith("", "_blank");
  expect(tab.location.href).toBe("");
  settle?.(null);
  await pending;
  expect(tab.close).toHaveBeenCalledOnce();
  expect(mocks.error).toHaveBeenCalledWith("Belge açılamadı", expect.any(Error));
  vi.unstubAllGlobals();
});
it("engellenen sekme hata bildirir ve URL sorgulamaz", async () => {
  mocks.consents = [{ _id: "consent-a", consentType: "photo", grantedAt: "2026-10-19T06:00:00Z", documentStorageId: "storage-a" }];
  vi.stubGlobal("window", { open: vi.fn(() => null) });
  render();
  await mocks.buttons.find(button => button.children === "Belgeyi aç")?.onClick?.();
  expect(mocks.query).not.toHaveBeenCalled();
  expect(mocks.error).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
it.each([0, 2])("parmak izi iptalinde bilinen %s kayıt sayısını gösterir", async count => {
  mocks.enrollments = Array.from({ length: count }, () => ({}));
  mocks.consents = [{ _id: "fp-a", consentType: "biometric_fingerprint", grantedAt: "2026-10-19T06:00:00Z" }];
  render();
  await mocks.buttons.find(button => button["aria-label"] === "Parmak izi rızasını iptal et")?.onClick?.();
  render();
  expect(mocks.confirm?.effects).toEqual([count > 0 ? `Cihazlardaki ${count} parmak izi kaydı da silinir.` : "Cihazlardaki parmak izi kayıtları da silinir."]);
});

it.each([
  [["employees.manage"], true, false],
  [["biometrics.manage"], false, true],
  [[], false, false],
] as const)("rıza türü kendi yetkisini kullanır: %j", (permissions, photo, biometric) => {
  mocks.permissions = [...permissions];
  mocks.enabled = true;
  const html = render();
  expect(html.includes('aria-label="Fotoğraf rızası al"')).toBe(photo);
  expect(html.includes('aria-label="Yüz tanıma rızası al"')).toBe(biometric);
  expect(html.includes('aria-label="Parmak izi rızası al"')).toBe(biometric);
});

it("başarısız rıza kaydında not ve belge korunur, yeniden denemede başarıyla kapanır", async () => {
  mocks.states = [null, "photo", "  İmzalı rıza notu  ", false];
  mocks.document.storageId = "storage-a";
  mocks.grant.mockRejectedValueOnce(new Error("network"));
  render();
  await mocks.buttons.find(button => button.children === "Rızayı kaydet")?.onClick?.();
  expect(mocks.states[1]).toBe("photo");
  expect(mocks.states[2]).toBe("  İmzalı rıza notu  ");
  expect(mocks.document.reset).not.toHaveBeenCalled();
  expect(mocks.success).not.toHaveBeenCalled();
  mocks.grant.mockResolvedValueOnce(null);
  render();
  await mocks.buttons.find(button => button.children === "Rızayı kaydet")?.onClick?.();
  expect(mocks.grant).toHaveBeenLastCalledWith({ employeeId, consentType: "photo", documentStorageId: "storage-a", notes: "İmzalı rıza notu" });
  expect(mocks.states[1]).toBeNull();
  expect(mocks.states[2]).toBe("");
  expect(mocks.document.reset).toHaveBeenCalledOnce();
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith("Rıza alındı", "Fotoğraf");
});
