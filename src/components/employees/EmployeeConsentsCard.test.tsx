import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ConfirmDestructiveProps } from "@/components/shared/ConfirmDestructive";
import { EmployeeConsentsCard } from "./EmployeeConsentsCard";

const mocks = vi.hoisted(() => ({
  enabled: false, consents: [] as { _id: string; consentType: string; grantedAt: string }[],
  states: [] as unknown[], cursor: 0, buttons: [] as { onClick?: () => unknown; disabled?: boolean; "aria-label"?: string; children?: unknown }[],
  confirm: null as ConfirmDestructiveProps | null,
  grant: vi.fn(), revoke: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [mocks.states[index], (next: unknown) => { mocks.states[index] = next; }];
  } };
});
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).includes("getEmployeeBiometricModule") ? { enabled: mocks.enabled } : mocks.consents,
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
  return renderToStaticMarkup(<EmployeeConsentsCard employeeId={employeeId} />);
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.enabled = false; mocks.consents = []; mocks.states = []; mocks.confirm = null;
});

describe("çalışan rıza kartı", () => {
  it("kapalı modülde yalnız biyometrik rıza düğmelerini pasifleştirir", () => {
    const html = render();
    expect(html).toContain("Biyometri modülü kapalı");
    for (const label of ["Yüz Tanıma", "Parmak İzi"]) expect(mocks.buttons.find(button => button["aria-label"] === `${label} rızası al`)?.disabled).toBe(true);
    expect(mocks.buttons.find(button => button["aria-label"] === "Kart Verisi rızası al")?.disabled).toBe(false);
    expect(mocks.buttons.find(button => button["aria-label"] === "Fotoğraf rızası al")?.disabled).toBe(false);
  });
  it("açık modülde biyometrik rıza açılır ve not etiketi alanla bağlıdır", () => {
    mocks.enabled = true;
    const html = render();
    expect(mocks.buttons.find(button => button["aria-label"] === "Yüz Tanıma rızası al")?.disabled).toBe(false);
    const label = html.match(/<label for="([^"]+)"/);
    expect(label?.[1]).toBeDefined();
    expect(html).toContain(`id="${label?.[1]}"`);
  });
  it("ilk iptal tıklaması mutation çağırmaz, onaydan sonra iptal eder", async () => {
    mocks.consents = [{ _id: "consent-a", consentType: "biometric_face", grantedAt: "2026-10-19T06:00:00Z" }];
    render();
    await mocks.buttons.find(button => button["aria-label"] === "Yüz Tanıma rızasını iptal et")?.onClick?.();
    expect(mocks.revoke).not.toHaveBeenCalled();
    render();
    expect(mocks.confirm?.open).toBe(true);
    expect(mocks.confirm?.effects.join(" ")).toContain("şablonlar bu işlemle silinmez");
    await mocks.confirm?.onConfirm();
    expect(mocks.revoke).toHaveBeenCalledWith({ id: "consent-a" });
  });
  it("grant hatasını ham message yerine notify'a nesne olarak iletir", async () => {
    mocks.enabled = true;
    render();
    await mocks.buttons.find(button => button["aria-label"] === "Yüz Tanıma rızası al")?.onClick?.();
    render();
    const error = new ConvexError({ code: "BIOMETRIC_DISABLED", message: "Biyometri modülü kapalı." });
    mocks.grant.mockRejectedValueOnce(error);
    await mocks.buttons.find(button => typeof button.onClick === "function" && button["aria-label"] === undefined && button.disabled === false && button.children === "Rıza Al")?.onClick?.();
    expect(mocks.error).toHaveBeenCalledWith("Rıza alınamadı", error);
  });
});
