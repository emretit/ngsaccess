import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncIssuesBanner } from "./SyncIssuesBanner";

const mocks = vi.hoisted(() => ({
  canDismiss: false, focus: vi.fn(), cancel: undefined as (() => void) | undefined, isSuperAdmin: false, operation: "deletePerson", reason: "", mutation: vi.fn(), actions: [] as Array<() => Promise<void>>,
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useRef: () => ({ current: { focus: mocks.focus } }),
  // Render the expanded banner and opened reason form without a browser DOM.
  useState: (value: unknown) => [typeof value === "boolean" ? true : value === "" ? mocks.reason : value, vi.fn()],
}));
vi.mock("@/components/ui/button", () => ({ Button: (props: import("react").ComponentProps<"button">) => {
  if (props.children === "Vazgeç") mocks.cancel = () => props.onClick?.({} as import("react").MouseEvent<HTMLButtonElement>);
  return <button {...props} />;
} }));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.mutation,
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => ({ items: getFunctionName(ref).startsWith("hikvisionSync:") ? [{
    _id: "issue", projectId: "project", deviceId: "device", deviceName: "Test cihazı", projectName: "Test projesi", operation: mocks.operation,
    attempts: 5, maxAttempts: 5, createdAt: 1, lastError: "Silme başarısız", canRetry: false, canDismiss: mocks.canDismiss,
  }] : [] }),
}));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", projectIds: ["project"], isAdmin: true, isSuperAdmin: mocks.isSuperAdmin, loading: false }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ setActiveProjectId: vi.fn() }) }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (action: () => Promise<void>) => { mocks.actions.push(action); return { run: action, pending: false }; } }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: () => null }));
const render = () => renderToStaticMarkup(<MemoryRouter><SyncIssuesBanner /></MemoryRouter>);
beforeEach(() => { mocks.canDismiss = false; mocks.focus.mockClear(); mocks.cancel = undefined; mocks.isSuperAdmin = false; mocks.operation = "deletePerson"; mocks.reason = ""; mocks.mutation.mockReset(); mocks.actions = []; });

describe("silme uyarısını gerekçeyle kapatma", () => {
  it("hides deletion closure from project admins while leaving normal issue closure available", () => {
    expect(render()).not.toContain('aria-label="Test cihazı uyarısını kapat"');
    mocks.operation = "addPerson";
    expect(render()).toContain('aria-label="Test cihazı uyarısını kapat"');
  });
  it("hides a resolvable deletion even from super admins", () => {
    mocks.isSuperAdmin = true;
    expect(render()).not.toContain('aria-label="Test cihazı uyarısını kapat"');
    expect(render()).not.toContain("Kapatma gerekçesi (zorunlu)");
  });
  it("returns focus to the close button after cancellation", () => {
    mocks.isSuperAdmin = true; mocks.canDismiss = true;
    render();
    mocks.cancel?.();
    expect(mocks.focus).toHaveBeenCalledOnce();
  });
  it("requires a labeled reason and disables closure for whitespace", () => {
    mocks.isSuperAdmin = true; mocks.canDismiss = true; mocks.reason = "  ";
    const html = render();
    expect(html).toContain("Kapatma gerekçesi (zorunlu)");
    expect(html).toMatch(/<textarea[^>]*required/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Gerekçeyle kapat/);
    expect(html).toContain("w-full min-w-0");
  });
  it("submits the trimmed reason to the existing endpoint", async () => {
    mocks.isSuperAdmin = true; mocks.canDismiss = true; mocks.reason = "  Cihaz kaldırıldı  ";
    render();
    await mocks.actions[0]?.();
    expect(mocks.mutation).toHaveBeenCalledWith({ issueId: "issue", reason: "Cihaz kaldırıldı" });
  });
});
