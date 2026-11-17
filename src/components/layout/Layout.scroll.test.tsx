import type { ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  refs: [] as { current: unknown }[], cursor: 0,
  location: { key: "focus-a", pathname: "/employees", search: "", hash: "" },
  navigation: "POP",
  effect: undefined as (() => void | (() => void)) | undefined,
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => {
    const index = state.cursor++;
    state.refs[index] ??= { current: initial };
    return state.refs[index];
  },
  useLayoutEffect: (effect: () => void | (() => void)) => { state.effect = effect; },
}));
vi.mock("react-router-dom", async original => ({
  ...await original<typeof import("react-router-dom")>(),
  useLocation: () => state.location,
  useNavigationType: () => state.navigation,
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }));
vi.mock("@/hooks/useDarkMode", () => ({ useDarkMode: () => {} }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ loading: false, session: {}, profile: { verified: true } }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ activeProjectId: "project" }) }));
import Layout from "@/components/Layout";

type Node = ReactElement<{ children?: unknown; ref?: { current: unknown } }>;
function findMain(value: unknown): Node | undefined {
  if (Array.isArray(value)) return value.map(findMain).find(Boolean);
  if (!value || typeof value !== "object" || !("props" in value)) return undefined;
  const node = value as Node;
  return node.type === "main" ? node : findMain(node.props.children);
}
beforeEach(() => {
  state.refs = []; state.cursor = 0; state.effect = undefined;
  state.location = { key: "focus-a", pathname: "/employees", search: "", hash: "" };
  state.navigation = "POP";
});

it("wires navigation to main, focuses without scrolling, preserves query scroll and restores history entries", () => {
  const listeners = new Map<string, () => void>();
  const main = {
    scrollTop: 0, scrollLeft: 0,
    focus: vi.fn(), querySelector: () => null,
    scrollTo: vi.fn(({ top = 0, left = 0 }: ScrollToOptions) => { main.scrollTop = top; main.scrollLeft = left; }),
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const active: { cleanup?: () => void } = {};
  const render = () => {
    state.cursor = 0;
    const ref = findMain(Layout())?.props.ref;
    if (!ref) throw new Error("Main ref missing");
    ref.current = main;
    active.cleanup?.();
    active.cleanup = state.effect?.() || undefined;
  };
  render();
  main.scrollTop = 700; listeners.get("scroll")?.();
  state.location = { ...state.location, key: "focus-b", pathname: "/devices" };
  state.navigation = "PUSH";
  render();
  expect(main.focus).toHaveBeenLastCalledWith({ preventScroll: true });
  expect(main.scrollTop).toBe(0);
  main.scrollTop = 200; listeners.get("scroll")?.();
  main.scrollTo.mockClear(); main.focus.mockClear();
  state.location = { ...state.location, key: "focus-query", search: "?status=online" };
  render();
  expect(main.scrollTo).not.toHaveBeenCalled();
  expect(main.focus).not.toHaveBeenCalled();
  expect(main.scrollTop).toBe(200);
  state.location = { key: "focus-a", pathname: "/employees", search: "", hash: "" };
  state.navigation = "POP";
  render();
  expect(main.scrollTop).toBe(700);
  expect(main.focus).toHaveBeenCalledWith({ preventScroll: true });
  active.cleanup?.();
});
