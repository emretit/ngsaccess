import { isValidElement, type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { AlarmContent } from "./Alarms";
import { AlarmFilters } from "@/components/alarms/AlarmFilters";
import { BulkBar } from "@/components/shared/BulkBar";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { useQuery, usePaginatedQuery } from "convex/react";
import { SegmentedViewControl } from "@/components/shared/SegmentedViewControl";

const state = vi.hoisted(() => ({ expandResults: true, projectId: "p1", slots: [] as unknown[], cursor: 0, deps: undefined as readonly unknown[] | undefined, effect: undefined as (() => void) | undefined }));
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
vi.mock("convex/react", () => ({ useQuery: vi.fn(() => []), useMutation: () => vi.fn(), usePaginatedQuery: vi.fn(() => ({ results: Array.from({ length: 51 }, (_, i) => ({ _id: `e${i}`, label: `Olay ${i}`, eventTime: "2026-11-01T00:00:00Z", severity: "warning" })), status: "Exhausted", loadMore: vi.fn() })) }));

type Node = ReactElement<{ count?: number; children?: unknown; start?: unknown; actions?: unknown; type?: string; checked?: boolean; disabled?: boolean; onChange?: (value: never) => void; value?: unknown }>;
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  if (state.expandResults && typeof node.type === "function" && node.type.name === "AlarmResults") {
    return nodes((node.type as (props: typeof node.props) => unknown)(node.props));
  }
  return [node, ...nodes([node.props.start, node.props.children, node.props.actions])];
}
function render() {
  state.cursor = 0;
  let tree = nodes(AlarmContent());
  if (state.effect) {
    const effect = state.effect; state.effect = undefined; effect();
    state.cursor = 0; tree = nodes(AlarmContent());
  }
  return tree;
}
function select(node: Node | undefined, checked: boolean) {
  if (!node?.props.onChange) throw new Error("Seçim bulunamadı");
  node.props.onChange({ target: { checked } } as never);
}
beforeEach(() => { state.expandResults = true; state.projectId = "p1"; state.slots = []; state.cursor = 0; state.deps = undefined; state.effect = undefined; });
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

it("query hooks run in separate boundary children while filters stay outside their failure scope", () => {
  state.expandResults = false;
  const tree = render();
  expect(tree.some(node => node.type === AlarmFilters)).toBe(true);
  const boundaries = tree.filter(node => node.type === QuerySectionBoundary);
  // SSR does not catch render errors: invoke each query child explicitly to
  // verify that its hook runs below (rather than before) the real boundary.
  for (const [index, hook] of [[0, useQuery], [1, usePaginatedQuery]] as const) {
    const boundary = boundaries[index];
    const child = boundary?.props.children as ReactElement<Record<string, unknown>>;
    expect(boundary?.type).toBe(QuerySectionBoundary);
    if (!child || typeof child.type !== "function") throw new Error("Sorgu çocuğu bulunamadı");
    const failure = new Error("Query failed");
    vi.mocked(hook).mockImplementationOnce(() => { throw failure; });
    expect(() => (child.type as (props: Record<string, unknown>) => unknown)(child.props)).toThrow(failure);
    const caught = new QuerySectionBoundary({ children: child });
    caught.state = { ...caught.state, ...QuerySectionBoundary.getDerivedStateFromError() };
    const fallback = caught.render();
    if (!isValidElement<Record<string, unknown>>(fallback)) throw new Error("Hata görünümü bulunamadı");
    expect(fallback.props.onRetry).toBeTypeOf("function");
  }
});

it("shows bulk acknowledgement beside results only while selection is actionable", () => {
  let tree = render();
  expect(tree.some(node => node.type === BulkBar && Boolean(node.props.count))).toBe(false);
  select(tree.find(node => node.props.type === "checkbox"), true);
  tree = render();
  expect(tree.some(node => node.type === BulkBar && Boolean(node.props.count))).toBe(true);
  const filters = tree.find(node => node.type === AlarmFilters);
  expect(filters?.props.actions).toBeUndefined();
  filters?.props.onChange?.(({ ...filters.props.value as object, status: "acked" }) as never);
  expect(render().some(node => node.type === BulkBar)).toBe(false);
});
