import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { AdminDeviceDialog } from "./AdminDeviceDialog";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useQuery: () => [] }));
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
