import type { DependencyList, EffectCallback, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Effect = { callback: EffectCallback; deps?: DependencyList; cleanup?: () => void };
const state = vi.hoisted(() => ({
  manage: true,
  params: new URLSearchParams(),
  changeTab: undefined as ((tab: string) => void) | undefined,
  cursor: 0,
  slots: [] as { value: unknown; set: (next: unknown) => void }[],
  dirty: false,
  pending: [] as Effect[],
  mounted: [] as Effect[],
  refresh: vi.fn(),
}));

// As in the existing hook tests, retain state across SSR renders and flush
// dependency-aware effects, including cleanup when the status panel unmounts.
// PageHeader and the header context/hook themselves are production components.
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = state.cursor++;
      let slot = state.slots[index];
      if (!slot) {
        slot = {
          value: typeof initial === "function" ? initial() : initial,
          set: (next: unknown) => {
            const current = state.slots[index];
            if (!current) return;
            const value = typeof next === "function" ? next(current.value) : next;
            if (!Object.is(value, current.value)) {
              current.value = value;
              state.dirty = true;
            }
          },
        };
        state.slots[index] = slot;
      }
      return [slot.value, slot.set];
    },
    useLayoutEffect: (callback: EffectCallback) => { callback(); },
    useEffect: (callback: EffectCallback, deps?: DependencyList) => {
      state.pending.push({ callback, deps });
    },
  };
});
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (permission: string) => permission === "accessRules.manage" && state.manage,
  }),
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({ projectId: "project", activeProject: { name: "NGS" } }),
}));
vi.mock("react-router-dom", () => ({
  useSearchParams: () => [
    state.params,
    (update: (previous: URLSearchParams) => URLSearchParams) => {
      state.params = update(state.params);
      state.dirty = true;
    },
  ],
}));
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, onValueChange }: { children: ReactNode; onValueChange: (tab: string) => void }) => {
    state.changeTab = onValueChange;
    return <div>{children}</div>;
  },
  TabsList: ({ children }: { children: ReactNode }) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button role="tab">{children}</button>,
  TabsContent: ({ children, value }: { children: ReactNode; value: string }) =>
    value === (state.manage ? state.params.get("tab") ?? "rules" : "rules")
      ? <section role="tabpanel">{children}</section> : null,
}));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({
  QuerySectionBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./AccessRulesList", () => ({ default: () => <p>Kurallar içeriği</p> }));
vi.mock("../door-plans/DoorPlansTab", () => ({ DoorPlansTab: () => <p>Kapı planları içeriği</p> }));
vi.mock("./CreateRuleDialog", () => ({ default: () => null }));
vi.mock("./SyncRuns", () => ({
  ProjectSyncButton: () => <button>Tüm cihazlara gönder</button>,
  RuleSaveNotice: () => null,
}));
vi.mock("./status/StatusPage", async () => {
  const { useAccessControlHeader } = await import("./hooks/useAccessControlHeader");
  function StatusPanel() {
    useAccessControlHeader("Yenile", state.refresh, false);
    return <p>Yetki durumu içeriği</p>;
  }
  return { default: StatusPanel };
});
import UnifiedAccessControl from "./UnifiedAccessControl";

function render() {
  for (let pass = 0; pass < 10; pass++) {
    state.cursor = 0;
    state.pending = [];
    state.dirty = false;
    const html = renderToStaticMarkup(<UnifiedAccessControl />);
    const previous = state.mounted;
    state.mounted = state.pending.map((effect, index) => {
      const old = previous[index];
      if (old?.deps && effect.deps && old.deps.length === effect.deps.length &&
          old.deps.every((value, i) => Object.is(value, effect.deps?.[i]))) return old;
      old?.cleanup?.();
      return { ...effect, cleanup: effect.callback() || undefined };
    });
    previous.slice(state.pending.length).forEach(effect => effect.cleanup?.());
    if (!state.dirty) return html;
  }
  throw new Error("Başlık effect'i render döngüsüne girdi");
}
function header(html: string) {
  // The production PageHeader precedes Tabs; assertions cannot pass because
  // an action accidentally remains in tab content.
  return html.split('role="tablist"')[0];
}
function switchTab(tab: string) {
  expect(state.changeTab).toBeTypeOf("function");
  state.changeTab?.(tab);
  return render();
}
beforeEach(() => {
  state.manage = true;
  state.params = new URLSearchParams();
  state.cursor = 0;
  state.slots = [];
  state.pending = [];
  state.mounted = [];
  state.changeTab = undefined;
  state.refresh.mockReset();
});
afterEach(() => state.mounted.forEach(effect => effect.cleanup?.()));

it("Kurallar başlığında yöneticiye Yeni kural ve Tüm cihazlara gönder gösterir", () => {
  const html = render();
  expect(header(html)).toContain("Geçiş Kontrol");
  expect(header(html)).toContain("Yeni kural");
  expect(header(html)).toContain("Tüm cihazlara gönder");
  expect(header(html)).not.toContain("Yenile");
});
it.each(["", "tab=status", "tab=doors"])("yetki yokken eylemleri ve yönetici sekmelerini gizler: %s", query => {
  state.manage = false;
  state.params = new URLSearchParams(query);
  const html = render();
  for (const text of ["Yeni kural", "Tüm cihazlara gönder", "Yenile", "Yetki Durumu", "Kapı Planları"])
    expect(html).not.toContain(text);
});
it("status URL'sinde hook Yenile'yi başlığa taşır ve Kurallar eylemlerini kaldırır", () => {
  state.params = new URLSearchParams("tab=status");
  const html = render();
  expect(header(html)).toContain("Yenile");
  expect(header(html)).not.toContain("Yeni kural");
  expect(header(html)).not.toContain("Tüm cihazlara gönder");
});
it("rules → status → doors → rules geçişlerinde önceki sekmenin eylemlerini kaldırır", () => {
  expect(header(render())).toContain("Yeni kural");
  const status = header(switchTab("status"));
  expect(status).toContain("Yenile");
  expect(status).not.toContain("Yeni kural");
  expect(status).not.toContain("Tüm cihazlara gönder");
  const doors = header(switchTab("doors"));
  for (const text of ["Yenile", "Yeni kural", "Tüm cihazlara gönder"])
    expect(doors).not.toContain(text);
  // The registered status action is cleared, rather than just hidden by tab.
  expect(state.slots[0]?.value).toBeUndefined();
  const rules = header(switchTab("rules"));
  expect(rules).toContain("Yeni kural");
  expect(rules).toContain("Tüm cihazlara gönder");
  expect(rules).not.toContain("Yenile");
  expect(state.params.has("tab")).toBe(false);
});
