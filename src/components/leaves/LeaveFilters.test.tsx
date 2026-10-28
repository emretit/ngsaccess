import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LeaveFilters } from "./LeaveFilters";
import { DateInput } from "@/components/ui/date-picker";
import { readFilters } from "./lib/leaveState";
import type { Id } from "../../../convex/_generated/dataModel";

const hooks = vi.hoisted(() => ({ active: false, index: 0, values: [] as unknown[] }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    if (!hooks.active) return actual.useState(initial);
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next; }];
  } };
});
vi.mock("convex/react", () => ({ useQuery: () => ({ options: [], selected: null }) }));
function dates(node: React.ReactNode): React.ReactElement<{ onChange: (value: string) => void }>[] {
  return React.Children.toArray(node).flatMap(child => {
    if (!React.isValidElement<{ children?: React.ReactNode; onChange: (value: string) => void }>(child)) return [];
    return child.type === DateInput ? [child] : dates(child.props.children);
  });
}
beforeEach(() => { hooks.active = false; hooks.index = 0; hooks.values = []; });
describe("inline leave range", () => {
  it("applies valid edits immediately and retains the last valid URL through reversed and empty edits", () => {
    const params = new URLSearchParams("period=custom&from=2026-10-01&to=2026-10-31");
    const change = vi.fn((patch: Record<string, string | undefined>) => {
      for (const [key, value] of Object.entries(patch)) { if (value === undefined) params.delete(key); else params.set(key, value); }
    });
    const draw = () => {
      hooks.active = true; hooks.index = 0;
      const tree = LeaveFilters({ projectId: "project" as Id<"projects">, filters: readFilters(params), onChange: change, onClear: vi.fn() });
      hooks.active = false;
      return tree;
    };
    dates(draw())[0].props.onChange("2026-10-10");
    expect(change).toHaveBeenLastCalledWith({ period: "custom", from: "2026-10-10", to: "2026-10-31" });
    expect(params.get("from")).toBe("2026-10-10");
    expect(params.get("period")).toBe("custom");
    dates(draw())[1].props.onChange("2026-10-05");
    expect(change).toHaveBeenCalledTimes(1);
    expect(params.get("to")).toBe("2026-10-31");
    const invalid = renderToStaticMarkup(draw());
    expect(invalid).toContain('id="leave-range-error"');
    expect(invalid).toContain("Bitiş tarihi başlangıçtan önce olamaz.");
    dates(draw())[0].props.onChange("2026-10-02");
    expect(change).toHaveBeenLastCalledWith({ period: "custom", from: "2026-10-02", to: "2026-10-05" });
    dates(draw())[1].props.onChange("");
    expect(change).toHaveBeenCalledTimes(2);
    expect(renderToStaticMarkup(draw())).toContain("Geçerli bir tarih girin.");
    expect(params.get("to")).toBe("2026-10-05");
    dates(draw())[1].props.onChange("2026-02-30");
    expect(change).toHaveBeenCalledTimes(2);
    expect(renderToStaticMarkup(draw())).toContain("Geçerli bir tarih girin.");
    expect(params.get("to")).toBe("2026-10-05");
  });
});
