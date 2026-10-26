import type { ButtonHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { EmployeeImportDialog } from "./EmployeeImportDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
const state = vi.hoisted(() => ({ manage: false, resync: vi.fn(), clicks: new Map<string, () => void>() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => [initial === "file" ? "done" : Array.isArray(initial) ? [{ rowNumber: 2, status: "created", message: "Kişi oluşturuldu" }] : initial, vi.fn()],
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.manage }) }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useAction: () => state.resync }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogHeader: Part, DialogTitle: Part };
});
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick }: ButtonHTMLAttributes<HTMLButtonElement>) => {
  if (typeof children === "string" && onClick) state.clicks.set(children, () => onClick({} as React.MouseEvent<HTMLButtonElement>));
  return <button>{children}</button>;
} }));
beforeEach(() => { vi.clearAllMocks(); state.manage = false; state.clicks.clear(); state.resync.mockResolvedValue({}); });
it.each([false, true])("K-10: import result offers manual resync only with devices.manage=%s", allowed => {
  state.manage = allowed;
  const close = vi.fn();
  const html = renderToStaticMarkup(<EmployeeImportDialog open onOpenChange={close} projectId={"p" as Id<"projects">} />);
  expect(html).toContain("1 kişi oluşturuldu");
  expect(state.resync).not.toHaveBeenCalled();
  if (allowed) {
    expect(html).toContain("Cihazlara gönder");
    state.clicks.get("Cihazlara gönder")?.();
    expect(state.resync).toHaveBeenCalledTimes(1);
  } else {
    expect(html).not.toContain(">Cihazlara gönder<");
    expect(html).toContain("Kişiler cihazlara otomatik gönderilecek");
    state.clicks.get("Kapat")?.();
    expect(close).toHaveBeenCalledWith(false);
  }
});
it("K-10: permission revoked after render prevents the manual resync call", () => {
  state.manage = true;
  renderToStaticMarkup(<EmployeeImportDialog open onOpenChange={() => {}} projectId={"p" as Id<"projects">} />);
  state.manage = false;
  state.clicks.get("Cihazlara gönder")?.();
  expect(state.resync).not.toHaveBeenCalled();
});
