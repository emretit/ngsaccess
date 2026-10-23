import { Children, isValidElement, type ReactNode, type ButtonHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Shift } from "./lib/planning";
import type { Id } from "../../../convex/_generated/dataModel";
import { ShiftTree } from "./ShiftTree";
const state = vi.hoisted(() => ({ manage: true, shifts: [] as Shift[], tree: null as ReactNode }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.manage }) }));
vi.mock("convex/react", () => ({ useQuery: () => state.shifts }));
vi.mock("./useShiftDefinitionActions", () => ({ useShiftDefinitionActions: () => ({ add: vi.fn(), edit: vi.fn() }) }));
vi.mock("@/components/shared/TreePanel", async original => ({ ...await original<typeof import("@/components/shared/TreePanel")>(), TreePanel: ({ children, header }: { children: ReactNode; header: ReactNode }) => { state.tree = children; return <nav>{header}{children}</nav>; } }));
vi.mock("@/components/shared/RowActions", () => ({ RowActions: ({ label, children }: { label: string; children: ReactNode }) => <div aria-label={label}>{children}</div> }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
const projectId = "project" as Id<"projects">;
const day = { _id: "day", projectId, name: "Gündüz", color: "blue", startTime: "09:00", endTime: "18:00" } as Shift;
const night = { ...day, _id: "night", name: "Gece", startTime: "22:00", endTime: "06:00", isActive: false } as Shift;
function buttons(node: ReactNode): ButtonHTMLAttributes<HTMLButtonElement>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>>(child)) return [];
    return [...(child.type === "button" ? [child.props] : []), ...buttons(child.props.children)];
  });
}
beforeEach(() => { state.manage = true; state.shifts = [night, day]; });
it("renders all shifts in time order, their hours and inactive state without counters", () => {
  const html = renderToStaticMarkup(<ShiftTree projectId={projectId} onSelectShift={vi.fn()} />);
  for (const label of ["Tüm vardiyalar", "Gündüz", "09:00–18:00", "22:00–06:00 (+1 gün)", "Pasif", "bg-blue-400"]) expect(html).toContain(label);
  expect(html.indexOf(">Gündüz<")).toBeLessThan(html.indexOf(">Gece<"));
  expect(html).not.toContain("Atama serisi");
  for (const label of ["Vardiya ekle", "Düzenle", "Kişi ata", ">Sil<"]) expect(html).toContain(label);
  // Pasif vardiyaya kişi atanamaz; menüde yalnız aktif Gündüz için "Kişi ata" var.
  expect(html.match(/Kişi ata/g)).toHaveLength(1);
});
it("selects an id, toggles the selected row, and clears with all shifts", () => {
  const select = vi.fn();
  renderToStaticMarkup(<ShiftTree projectId={projectId} onSelectShift={select} />);
  buttons(state.tree)[1]?.onClick?.({} as Parameters<NonNullable<ButtonHTMLAttributes<HTMLButtonElement>["onClick"]>>[0]);
  expect(select).toHaveBeenLastCalledWith(day._id);
  renderToStaticMarkup(<ShiftTree projectId={projectId} selectedShiftId={day._id} onSelectShift={select} />);
  const rows = buttons(state.tree);
  expect(rows[1]?.["aria-pressed"]).toBe(true);
  rows[1]?.onClick?.({} as Parameters<NonNullable<ButtonHTMLAttributes<HTMLButtonElement>["onClick"]>>[0]);
  expect(select).toHaveBeenLastCalledWith(undefined);
  rows[0]?.onClick?.({} as Parameters<NonNullable<ButtonHTMLAttributes<HTMLButtonElement>["onClick"]>>[0]);
  expect(select).toHaveBeenLastCalledWith(undefined);
});
it("hides create and row actions from viewers", () => {
  state.manage = false;
  const html = renderToStaticMarkup(<ShiftTree projectId={projectId} onSelectShift={vi.fn()} />);
  for (const label of ["Vardiya ekle", "işlemleri", "Düzenle", "Kişi ata", ">Sil<"]) expect(html).not.toContain(label);
});
it("offers an empty state and create action for managers", () => {
  state.shifts = [];
  const html = renderToStaticMarkup(<ShiftTree projectId={projectId} onSelectShift={vi.fn()} />);
  expect(html).toContain("Henüz vardiya yok");
  expect(html).toContain("Vardiya ekle");
});
