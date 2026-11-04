import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Alarms from "./Alarms";
import { AlarmFilters } from "@/components/alarms/AlarmFilters";
import { SegmentedViewControl } from "@/components/shared/SegmentedViewControl";

const state = vi.hoisted(() => ({ projectId: "p1", slots: [] as unknown[], cursor: 0, deps: undefined as readonly unknown[] | undefined, effect: undefined as (() => void) | undefined }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: <T,>(initial: T) => {
    const index = state.cursor++;
    if (!(index in state.slots)) state.slots[index] = initial;
    return [state.slots[index], (next: T | ((current: T) => T)) => {
      state.slots[index] = typeof next === "function" ? (next as (current: T) => T)(state.slots[index] as T) : next;
    }];
  },
  useEffect: (effect: () => void, deps: readonly unknown[]) => {
    if (!state.deps || deps.some((dep, i) => !Object.is(dep, state.deps?.[i]))) state.effect = effect;
    state.deps = deps;
  },
}));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [new URLSearchParams()] }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permission === "alarms.ack" }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: state.projectId, activeProject: { name: state.projectId }, loading: false }) }));
vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => vi.fn(), usePaginatedQuery: () => ({ results: Array.from({ length: 51 }, (_, i) => ({ _id: `e${i}`, label: `Olay ${i}`, eventTime: "2026-11-01T00:00:00Z", severity: "warning" })), status: "Exhausted", loadMore: vi.fn() }) }));

type Node = ReactElement<{ children?: unknown; type?: string; checked?: boolean; disabled?: boolean; onChange?: (value: never) => void; value?: unknown }>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function render() {
  state.cursor = 0;
  let tree = nodes(Alarms());
  if (state.effect) {
    const effect = state.effect; state.effect = undefined; effect();
    state.cursor = 0; tree = nodes(Alarms());
  }
  return tree;
}
function select(node: Node | undefined, checked: boolean) {
  if (!node?.props.onChange) throw new Error("Seçim bulunamadı");
  node.props.onChange({ target: { checked } } as never);
}
beforeEach(() => { state.projectId = "p1"; state.slots = []; state.cursor = 0; state.deps = undefined; state.effect = undefined; });
it("ALM-010 clears selection on project, category and filter changes", () => {
  for (const change of ["project", "category", "filter"]) {
    const tree = render();
    select(tree.find(node => node.props.type === "checkbox"), true);
    expect(render().filter(node => node.props.checked)).toHaveLength(1);
    if (change === "project") state.projectId = "p2";
    else {
      const control = render().find(node => node.type === (change === "category" ? SegmentedViewControl : AlarmFilters));
      control?.props.onChange?.((change === "category" ? "exception" : { ...control.props.value as object, severity: "critical" }) as never);
    }
    expect(render().filter(node => node.props.checked)).toHaveLength(0);
  }
});
it("ALM-010 caps selection at 50, allows deselection and guards queued changes", () => {
  const checkboxes = render().filter(node => node.props.type === "checkbox");
  for (const checkbox of checkboxes) select(checkbox, true);
  const capped = render().filter(node => node.props.type === "checkbox");
  expect(capped.filter(node => node.props.checked)).toHaveLength(50);
  expect(capped[50]?.props.disabled).toBe(true);
  expect(capped[0]?.props.disabled).toBe(false);
  select(capped[0], false);
  const freed = render().filter(node => node.props.type === "checkbox");
  expect(freed[50]?.props.disabled).toBe(false);
  select(freed[50], true);
  expect(render().filter(node => node.props.checked)).toHaveLength(50);
});
