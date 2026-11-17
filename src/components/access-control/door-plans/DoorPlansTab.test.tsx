import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DoorPlansTab } from "./DoorPlansTab";
import { DoorPlanDialog, type DoorPlanTarget } from "./DoorPlanDialog";
import { TableRow } from "@/components/ui/table";
import { TableStateRow } from "@/components/shared/TableStateRow";
import { FilterBar } from "@/components/shared/FilterBar";
import { PaginationBar } from "@/components/shared/PaginationBar";

const state = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  targets: [] as DoorPlanTarget[],
  projectId: "project" as string | undefined,
  navigate: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (state.slots.length <= index)
      state.slots[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      state.slots[index],
      (next: unknown) => {
        state.slots[index] =
          typeof next === "function"
            ? (next as (previous: unknown) => unknown)(state.slots[index])
            : next;
      },
    ];
  },
}));
vi.mock("convex/react", () => ({ useQuery: () => state.targets }));
vi.mock("react-router-dom", () => ({ useNavigate: () => state.navigate }));
vi.mock("@/hooks/useActiveProjectScope", () => ({
  useActiveProjectScope: () => ({ projectId: state.projectId, loading: false }),
}));
// Keep the dialog boundary observable without invoking its own form hooks.
vi.mock("./DoorPlanDialog", () => ({ DoorPlanDialog: () => null }));

type Props = Record<string, unknown> & { children?: ReactNode };
type Element = ReactElement<Props>;

function pathTo(
  tree: ReactNode,
  predicate: (node: Element) => boolean,
): Element[] | undefined {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const path = pathTo(child, predicate);
      if (path) return path;
    }
  } else if (isValidElement<Props>(tree)) {
    if (predicate(tree)) return [tree];
    const children = pathTo(tree.props.children, predicate);
    if (children) return [tree, ...children];
  }
}

function find(tree: ReactNode, predicate: (node: Element) => boolean): Element {
  const path = pathTo(tree, predicate);
  const node = path?.[path.length - 1];
  if (!node) throw new Error("Element bulunamadı");
  return node;
}

// Like tableRowClick.test.ts, supply the DOM surface used by the real row helper.
// Bubble through actual rendered handlers so moving/removing stopPropagation fails.
class ClickElement {
  closest() { return null; }
  contains() { return true; }
}
function bubbleClick(path: Element[]) {
  let stopped = false;
  const target = new ClickElement();
  const event = {
    target,
    currentTarget: target,
    stopPropagation: () => { stopped = true; },
  } as unknown as MouseEvent<HTMLElement>;
  for (const node of [...path].reverse()) {
    const onClick = node.props.onClick;
    if (typeof onClick === "function")
      (onClick as (event: MouseEvent<HTMLElement>) => void)(event);
    if (stopped) break;
  }
}

const door: DoorPlanTarget = {
  doorId: "door" as DoorPlanTarget["doorId"],
  projectId: "project" as DoorPlanTarget["projectId"],
  doorName: "Giriş",
  deviceName: "Gateway",
  deviceOnline: true,
  zoneName: null,
  hikPlanSavedAt: null,
  hikPlanAppliedAt: null,
  hikPlanApplyError: null,
  hikPlanFailedAt: null,
  plansPending: false,
  hikDoorHolidayPlan: null,
  holidaySupported: null,
  hikDoorStatusPlan: null,
  hikVerifyPlan: null,
};
function render() {
  state.cursor = 0;
  return DoorPlansTab();
}
beforeEach(() => {
  state.projectId = "project";
  state.slots = [];
  state.targets = [door];
  state.navigate.mockClear();
  vi.stubGlobal("Element", ClickElement);
  vi.stubGlobal("window", { getSelection: () => ({ toString: () => "" }) });
});
afterEach(() => vi.unstubAllGlobals());

describe("DoorPlansTab satır etkileşimleri", () => {
  it("tüm yüklenen kapılarda arar, filtre değişince ilk sayfaya döner", () => {
    state.targets = Array.from({ length: 41 }, (_, i) => ({ ...door, doorId: `door-${i}` as DoorPlanTarget["doorId"], doorName: `Kapı ${i}`, zoneName: i === 40 ? "Uzaktaki bölge" : null }));
    let tree = render();
    expect(renderToStaticMarkup(tree)).not.toContain("Kapı 40");
    const next = find(tree, node => node.type === PaginationBar).props.onNext as () => void;
    next();
    tree = render();
    expect(find(tree, node => node.type === PaginationBar).props.page).toBe(2);
    const search = find(tree, node => node.type === FilterBar).props.onSearchChange as (value: string) => void;
    search("uzaktaki");
    tree = render();
    expect(renderToStaticMarkup(tree)).toContain("Kapı 40");
    expect(pathTo(tree, node => node.type === PaginationBar)).toBeUndefined();
    search("");
    expect(find(render(), node => node.type === PaginationBar).props.page).toBe(1);
  });

  it("sayfadaki toplu seçim diğer sayfaların kapılarını seçmez", () => {
    state.targets = Array.from({ length: 41 }, (_, i) => ({ ...door, doorId: `door-${i}` as DoorPlanTarget["doorId"] }));
    const toggle = find(render(), node => node.type === "input" && node.props["aria-label"] === "Bu sayfadaki kapıları seç").props.onChange as (event: { target: { checked: boolean } }) => void;
    toggle({ target: { checked: true } });
    const html = renderToStaticMarkup(render());
    expect(html).toContain("20 kapı seçildi");
  });

  it("ayrıntı kontrolü dışındaki plan özetine tıklayınca kapının diyaloğunu açar", () => {
    const tree = render();
    const row = find(tree, (node) => node.type === TableRow && node.key === door.doorId);
    const cell = find(row, (node) => node.props.className === "order-3 text-sm");
    const summary = find(cell, (node) => node.type === "p");
    const path = pathTo(row, (node) => node === summary);
    if (!path) throw new Error("Plan özeti bulunamadı");
    bubbleClick(path);
    const dialog = find(render(), (node) => node.type === DoorPlanDialog);
    expect(dialog.props.open).toBe(true);
    expect(dialog.props.door).toBe(door);
  });

  it.each(["details", "summary"])("%s tıklaması kapı diyaloğunu açmaz", (tag) => {
    const tree = render();
    const row = find(tree, (node) => node.type === TableRow && node.key === door.doorId);
    const path = pathTo(row, (node) => node.type === tag);
    if (!path) throw new Error("Plan ayrıntıları bulunamadı");
    bubbleClick(path);
    expect(pathTo(render(), (node) => node.type === DoorPlanDialog)).toBeUndefined();
  });

  it("açık diyaloğa takvim değişiminden sonraki güncel hedefi geçirir", () => {
    const row = find(render(), node => node.type === TableRow && node.key === door.doorId);
    const path = pathTo(row, node => node.type === "p");
    if (!path) throw new Error("Kapı satırı bulunamadı");
    bubbleClick(path);
    const updated = { ...door, planRevision: 2, plansPending: true, pendingReason: "Tatil takvimi değişti; cihaza tekrar gönderin" };
    state.targets = [updated];
    expect(find(render(), node => node.type === DoorPlanDialog).props.door).toBe(updated);
  });

  it("boş listede kapsamı ve cihazlara geçişi gösterir", () => {
    state.targets = [];
    const tree = render();
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("Plan kurulabilecek Hikvision kapısı yok");
    expect(html).toContain("Kapı planları Hikvision gateway kapılarında desteklenir.");
    expect(html).toContain("Cihazlara git");
    const emptyRow = find(tree, (node) => node.type === TableStateRow);
    const action = emptyRow.props.action as { label: string; onClick: () => void };
    expect(action.label).toBe("Cihazlara git");
    action.onClick();
    expect(state.navigate).toHaveBeenCalledExactlyOnceWith("/devices");
  });
});

it("proje yokken envanter eksikliği veya cihaz CTA'sı yerine proje seçimini ister", () => {
  state.projectId = undefined;
  state.targets = [];
  const html = renderToStaticMarkup(render());
  expect(html).toContain("Bir proje seçin");
  expect(html).toContain("üst çubuktan proje seçin");
  expect(html).not.toContain("Plan kurulabilecek Hikvision kapısı yok");
  expect(html).not.toContain("Cihazlara git");
  expect(state.navigate).not.toHaveBeenCalled();
});
