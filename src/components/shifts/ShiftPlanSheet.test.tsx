import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ShiftPlanSheet, useShiftPlanOpen } from "./ShiftPlanSheet";
const state = vi.hoisted(() => ({ projectId: "project" as string | null, loading: false, params: new URLSearchParams(), openDefinitions: (_hasDefinitions: boolean) => {}, sheetOpen: false, onOpenChange: (_open: boolean) => {} }));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [state.params, (update: (previous: URLSearchParams) => URLSearchParams) => { state.params = update(state.params); }] }));
vi.mock("./ShiftCalendarView", () => ({ ShiftCalendarView: ({ openDefinitions }: { openDefinitions: (hasDefinitions: boolean) => void }) => { state.openDefinitions = openDefinitions; return <div>Takvim</div>; } }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: state.projectId, activeProject: { name: "Proje" }, loading: state.loading }) }));
vi.mock("@/components/ui/sheet", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Sheet: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) => { state.sheetOpen = open; state.onOpenChange = onOpenChange; return <div>{children}</div>; }, SheetContent: Box, SheetHeader: Box, SheetTitle: Box, SheetDescription: Box };
});
beforeEach(() => { state.projectId = "project"; state.loading = false; state.params = new URLSearchParams("shift=day&person=Ayse&plan=1"); });
it("opens from plan=1 and preserves other parameters when closing and reopening", () => {
  function Controls() { const { open, setOpen } = useShiftPlanOpen(); state.sheetOpen = open; state.onOpenChange = setOpen; return null; }
  renderToStaticMarkup(<Controls />);
  expect(state.sheetOpen).toBe(true);
  state.onOpenChange(false);
  expect(state.params.toString()).toBe("shift=day&person=Ayse");
  state.onOpenChange(true);
  expect(state.params.toString()).toBe("shift=day&person=Ayse&plan=1");
});
it("closes the calendar and opens create only when there are no definitions", () => {
  const create = vi.fn();
  const html = renderToStaticMarkup(<ShiftPlanSheet onCreateShift={create} />);
  expect(html.match(/Vardiya planı/g)).toHaveLength(1);
  state.openDefinitions(true);
  expect(state.params.has("plan")).toBe(false);
  expect(create).not.toHaveBeenCalled();
  state.openDefinitions(false);
  expect(create).toHaveBeenCalledOnce();
});
it("opens from plan=1 without a project and explains instead of staying stuck", () => {
  state.projectId = null;
  const html = renderToStaticMarkup(<ShiftPlanSheet onCreateShift={vi.fn()} />);
  expect(state.sheetOpen).toBe(true);
  expect(html).toContain("Proje seçin");
  expect(html).not.toContain("Takvim");
});
