vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => mocks.admin, loading: false }) }));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmployeeFingerprintCard } from "./EmployeeFingerprintCard";

const mocks = vi.hoisted(() => ({ admin: true, enabled: true, consent: true, scanned: false, active: true, hasDevice: true, fingerNos: [2], covered: true, statuses: [] as string[], actions: [] as (() => Promise<unknown>)[], begin: vi.fn(), enroll: vi.fn(), buttons: [] as { children?: ReactNode; disabled?: boolean; "aria-label"?: string; "aria-describedby"?: string }[] }));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => {
    const [value, setValue] = react.useState(initial);
    return [value, (next: unknown) => { if (typeof next === "string") mocks.statuses.push(next); setValue(next); }];
  } };
});
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (action: () => Promise<unknown>) => {
  mocks.actions.push(action);
  return { run: action, pending: false };
} }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ isAdmin: mocks.admin }) }));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name.includes("getEmployeeBiometricModule")) return { enabled: mocks.enabled };
    if (name.includes("employeeConsents")) return mocks.consent ? [{ consentType: "biometric_fingerprint" }] : [];
    return { templates: mocks.fingerNos.map(fingerNo => ({ fingerNo, enrolledAt: "2026-10-22T08:00:00Z", deviceIds: mocks.covered ? ["device-a"] : [] })), active: mocks.active, devices: mocks.hasDevice ? [{ _id: "device-a", name: "Panel", capabilitiesScanned: mocks.scanned }] : [], enrollments: mocks.fingerNos.map(fingerNo => ({ _id: `row-${fingerNo}`, deviceId: "device-a", deviceName: "Panel", fingerNo, enrolledAt: "2026-10-22T08:00:00Z" })) };
  },
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).includes("enrollFingerprintOnDevice") ? mocks.enroll : vi.fn(),
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).includes("beginEnrollment") ? mocks.begin : vi.fn(),
}));
vi.mock("@/components/ui/button", () => ({ Button: (props: { children?: ReactNode; disabled?: boolean; "aria-label"?: string; "aria-describedby"?: string }) => { mocks.buttons.push(props); return <button disabled={props.disabled} aria-label={props["aria-label"]} aria-describedby={props["aria-describedby"]}>{props.children}</button>; } }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogFooter: Part, DialogHeader: Part, DialogTitle: Part };
});
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: () => null }));
const employeeId = "employee-a" as Id<"employees">;
function render() { return renderToStaticMarkup(<EmployeeFingerprintCard employeeId={employeeId} />); }
beforeEach(() => { mocks.admin = true; mocks.enabled = true; mocks.consent = true; mocks.scanned = false; mocks.active = true; mocks.hasDevice = true; mocks.covered = true; mocks.buttons = []; mocks.fingerNos = [2]; mocks.statuses = []; mocks.actions = []; mocks.begin.mockReset(); mocks.enroll.mockReset(); });

describe("parmak izi kartı", () => {
  it("sensör yönergesi yalnız begin başarılı olunca gösterilir", async () => {
    let resolveBegin: (value: string) => void = () => {};
    mocks.begin.mockImplementation(() => new Promise<string>(resolve => { resolveBegin = resolve; }));
    render();
    const running = mocks.actions[0]();
    expect(mocks.statuses).toEqual(["Parmak izi işlemi başlatılıyor…"]);
    expect(mocks.enroll).not.toHaveBeenCalled();
    resolveBegin("attempt-a");
    await running;
    expect(mocks.statuses[1]).toBe("Cihazda parmağınızı okutun; yaklaşık 30 saniye beklenir.");
    expect(mocks.enroll).toHaveBeenCalledWith({ employeeId, deviceId: "device-a", fingerNo: 1, attemptId: "attempt-a" });
  });
  it("begin hatası sensör yönergesini göstermez", async () => {
    mocks.begin.mockRejectedValue(new Error("blocked"));
    render();
    await expect(mocks.actions[0]()).rejects.toThrow("blocked");
    expect(mocks.statuses.join(" ")).not.toContain("Cihazda parmağınızı okutun");
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("parmak seçtirmez; ilk boş slotla kayıt başlatır", async () => {
    mocks.fingerNos = [1, 2, 4];
    mocks.begin.mockResolvedValue("attempt-a");
    render();
    await mocks.actions[0]();
    expect(mocks.begin).toHaveBeenCalledWith({ employeeId, deviceId: "device-a", fingerNo: 3 });
  });
  it("5 parmak izi doluysa kayıt düğmesini açıklamayla kapatır", async () => {
    mocks.fingerNos = [1, 2, 3, 4, 7];
    const html = render();
    expect(mocks.buttons.find(button => button.children === "Kaydı başlat")?.disabled).toBe(true);
    expect(html).toContain("en fazla 5 parmak izi kaydedilebilir");
    await mocks.actions[0]();
    expect(mocks.begin).not.toHaveBeenCalled();
  });
  it("eski 6-10 slotu da görünen ad ve erişilebilir adda aynı etiketi kullanır", () => {
    mocks.fingerNos = [7];
    const html = render();
    expect(html).toContain('aria-label="Parmak izi 7 sistemden ve tüm cihazlardan sil"');
    expect(html).toContain("Parmak izi 7 · 1/1 cihazda");
    expect(html).not.toContain("undefined");
    expect(html).toContain("sistemden ve tüm cihazlardan sil");
  });
  it("eksik cihaz için yeniden gönderme düğmesi gösterir", () => { mocks.covered = false; expect(render()).toContain("Cihazlara yeniden gönder"); });
  it.each(["role", "module"])("%s izni yoksa görünmez", condition => {
    if (condition === "role") mocks.admin = false; else mocks.enabled = false;
    expect(render()).toBe("");
  });
  it("snapshot yokken uyarı gösterir ve kayıt düğmesini açık tutar", () => {
    const html = render();
    expect(html).toContain("Cihaz özellikleri taranmadı; Cihazlar &gt; cihaz &gt; Özellikleri tara");
    expect(mocks.buttons.find(button => button.children === "Kaydı başlat")?.disabled).toBe(false);
    expect(html).toContain("Parmak izi şifreli olarak sistemde saklanır");
    expect(html).toContain("Puantajda kullanılmaz");
    expect(html).toContain("parmak izi destekleyen erişim cihazları");
    expect(html).toContain("Parmak izi 2 · 1/1 cihazda");
    expect(html).toContain("Herhangi bir parmak okutulabilir");
    expect(html).toContain('role="status"');
    expect(html.match(/<option/g)?.length).toBe(1);
  });
  it.each(["consent", "inactive", "device"])("%s şartı eksikse açıklamayla kayıt düğmesini kapatır", condition => {
    if (condition === "consent") mocks.consent = false;
    if (condition === "inactive") mocks.active = false;
    if (condition === "device") mocks.hasDevice = false;
    const html = render();
    const button = mocks.buttons.find(button => button.children === "Kaydı başlat");
    expect(button?.disabled).toBe(true);
    expect(button?.["aria-describedby"]).toBeTruthy();
    expect(html).toContain(condition === "consent" ? "açık rıza gerekli" : condition === "inactive" ? "Pasif kişiye" : "uygun Hik gateway");
  });
});
