import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { AdminDeviceDialog } from "./AdminDeviceDialog";

const mocks = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, actions: [] as (() => Promise<void>)[], reserve: vi.fn(), other: vi.fn() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [mocks.states[index], (value: unknown) => { mocks.states[index] = value; }];
  },
  useEffect: () => {},
}));
vi.mock("convex/react", () => ({ useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "adminDevices:reserve" ? mocks.reserve : mocks.other, useQuery: () => [] }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (run: () => Promise<void>) => {
  mocks.actions.push(run);
  return { run, pending: false };
} }));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn() }, errorMessage: (error: unknown) => String(error) }));
beforeEach(() => {
  mocks.states = [];
  mocks.cursor = 0;
  mocks.actions = [];
  mocks.reserve.mockReset();
  mocks.other.mockReset();
});
vi.mock("./hooks/useAdminFormGuard", () => ({ useAdminFormGuard: () => ({ requestClose: vi.fn(), dialog: null }) }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: () => null }));
vi.mock("@/components/ui/sheet", () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Sheet: Wrapper, SheetContent: Wrapper, SheetHeader: Wrapper, SheetTitle: Wrapper, SheetDescription: Wrapper };
});
vi.mock("@/components/ui/select", () => ({
  Select: ({ disabled, children }: { disabled?: boolean; children?: ReactNode }) => <fieldset data-testid="project-picker" disabled={disabled}>{children}</fieldset>,
  SelectTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

type Device = FunctionReturnType<typeof api.adminDevices.list>[number];
const device = {
  _id: "admin" as Id<"adminDevices">, _creationTime: 0, name: "Hik", brand: "hikvision", createdAt: "now", updatedAt: "now",
  assignedProjectId: "project" as Id<"projects">, assignedDeviceId: "device" as Id<"devices">,
  assignedProjectName: "Project",
} satisfies Device;
const render = (brand: "hikvision" | "ide_smart") => renderToStaticMarkup(<AdminDeviceDialog open device={{ ...device, brand }} onClose={vi.fn()} onSuccess={vi.fn()} />);
describe("Hik device editing", () => {
  it("locks the project selector and explains the supported move procedure", () => {
    const html = render("hikvision");
    expect(html).toMatch(/<fieldset[^>]*data-testid="project-picker"[^>]*disabled/);
    expect(html).toContain("Hikvision cihazının projesi değiştirilemez.");
    expect(html).toContain("eklerken cihazdaki eski kişiler temizlenir.");
    const nameInput = html.match(/<input[^>]*id="admin-device-name"[^>]*>/)?.[0];
    expect(nameInput).toBeDefined();
    expect(nameInput).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });
  it("preserves the IDE project selector", () => {
    const html = render("ide_smart");
    expect(html).not.toMatch(/<fieldset[^>]*disabled/);
    expect(html).not.toContain("Hikvision cihazının projesi değiştirilemez.");
  });
});

it.each(["ide_smart", "hikvision", "other"] as const)("reserves an unclaimed %s device without claiming it", async brand => {
  mocks.states = [{ ...device, brand, assignedDeviceId: undefined }, "", "Pool", "target"];
  const html = renderToStaticMarkup(<AdminDeviceDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
  expect(html).toContain("Havuz cihazı seçilen projeye ayrılır.");
  expect(html).not.toMatch(/<fieldset[^>]*disabled/);
  await mocks.actions[1]();
  expect(mocks.reserve).toHaveBeenCalledExactlyOnceWith({ adminDeviceId: "admin", expectedAssignedProjectId: "project", projectId: "target", name: "Pool" });
  expect(mocks.other).not.toHaveBeenCalled();
});
it("registers a new IDE device and reserves it without creating project topology", async () => {
  mocks.states = [undefined, "123456789012345", "Pool", "target"];
  mocks.other.mockResolvedValueOnce("new-pool");
  renderToStaticMarkup(<AdminDeviceDialog open onClose={vi.fn()} onSuccess={vi.fn()} />);
  await mocks.actions[0]();
  expect(mocks.other).toHaveBeenCalledExactlyOnceWith({ ideUuid: "123456789012345", name: "Pool", brand: "ide_smart" });
  expect(mocks.reserve).toHaveBeenCalledExactlyOnceWith({ adminDeviceId: "new-pool", expectedAssignedProjectId: null, projectId: "target", name: "Pool" });
});
