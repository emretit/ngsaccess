import { isValidElement, type MouseEvent, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebarNav } from "./AppSidebarNav";
import { AppSidebar } from "./AppSidebar";

const sheet = vi.hoisted(() => ({
  closeFocus: undefined as ((event: Event) => void) | undefined,
  changeOpen: undefined as ((open: boolean) => void) | undefined,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, onOpenChange }: { children: ReactNode; onOpenChange: (open: boolean) => void }) => {
    sheet.changeOpen = onOpenChange;
    return <>{children}</>;
  },
  SheetContent: ({ children, onCloseAutoFocus }: { children: ReactNode; onCloseAutoFocus: (event: Event) => void }) => {
    sheet.closeFocus = onCloseAutoFocus;
    return <div>{children}</div>;
  },
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "admin", loading: false }) }));

type Node = ReactElement<{ children?: ReactNode; to?: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }>;
function findLink(value: ReactNode, to: string): Node | undefined {
  if (Array.isArray(value)) return value.map(child => findLink(child, to)).find(Boolean);
  if (!isValidElement<Node["props"]>(value)) return undefined;
  return value.props.to === to ? value : findLink(value.props.children, to);
}
const trigger = { focus: vi.fn() };
const main = { focus: vi.fn() };
let activeDialog = false;
const trees: { nav?: ReactNode; brand?: ReactNode } = {};
const captureTrees = vi.fn<(nav: ReactNode, brand: ReactNode) => void>();
function Probe() {
  const nav = AppSidebarNav();
  captureTrees(nav, AppSidebar());
  return nav;
}
function mount(path = "/settings") {
  renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><SidebarProvider><Sidebar><Probe /></Sidebar></SidebarProvider></MemoryRouter>);
  const rendered = captureTrees.mock.calls[captureTrees.mock.calls.length - 1];
  trees.nav = rendered?.[0];
  trees.brand = rendered?.[1];
  expect(sheet.closeFocus).toBeTypeOf("function");
}
function click(value: ReactNode, to: string, options: Partial<MouseEvent<HTMLAnchorElement>> = {}) {
  const link = findLink(value, to);
  if (!link?.props.onClick) throw new Error(`Missing link ${to}`);
  link.props.onClick({
    button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    currentTarget: { target: "", hasAttribute: () => false }, ...options,
  } as MouseEvent<HTMLAnchorElement>);
}
function closeFocus() {
  const preventDefault = vi.fn();
  sheet.closeFocus?.({ preventDefault } as unknown as Event);
  expect(preventDefault).toHaveBeenCalledOnce();
}
beforeEach(() => {
  activeDialog = false;
  captureTrees.mockClear();
  sheet.closeFocus = undefined; sheet.changeOpen = undefined;
  trigger.focus.mockClear(); main.focus.mockClear();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal("document", { getElementById: (id: string) => id === "main" ? main : null, querySelector: (selector: string) => selector === '[data-sidebar="trigger"]' ? trigger : activeDialog ? {} : null });
});
afterEach(() => vi.unstubAllGlobals());

it("route selection leaves main focused after the sheet close autofocus lifecycle", () => {
  mount();
  click(trees.nav, "/devices");
  closeFocus();
  expect(main.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(trigger.focus).not.toHaveBeenCalled();
  // Navigation intent is consumed, so a later ordinary dismissal restores trigger.
  sheet.changeOpen?.(false);
  closeFocus();
  expect(trigger.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
});

it("ordinary dismissal including Escape retains trigger focus", () => {
  mount();
  sheet.changeOpen?.(false);
  closeFocus();
  expect(trigger.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  expect(main.focus).not.toHaveBeenCalled();
});

it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }, { defaultPrevented: true }])("modified or cancelled link activation does not set navigation focus intent: %o", options => {
  mount();
  click(trees.nav, "/devices", options);
  closeFocus();
  expect(main.focus).not.toHaveBeenCalled();
  expect(trigger.focus).toHaveBeenCalledOnce();
});

it("report group and brand links use the same navigation close intent", () => {
  mount("/reports");
  click(trees.nav, "/reports/gunluk");
  closeFocus();
  expect(main.focus).toHaveBeenCalledOnce();
  click(trees.brand, "/home");
  closeFocus();
  expect(main.focus).toHaveBeenCalledTimes(2);
  expect(trigger.focus).not.toHaveBeenCalled();
});

it("a blocked navigation confirmation keeps modal focus ownership during sheet close", () => {
  mount();
  click(trees.nav, "/devices");
  // The router guard opens its AlertDialog before the sheet exit completes.
  activeDialog = true;
  closeFocus();
  expect(main.focus).not.toHaveBeenCalled();
  expect(trigger.focus).not.toHaveBeenCalled();
  // The intent is consumed; it cannot leak into a subsequent ordinary close.
  activeDialog = false;
  closeFocus();
  expect(trigger.focus).toHaveBeenCalledOnce();
});
