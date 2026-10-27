import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UNSAFE_NavigationContext, type Navigator } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardedFormNavigationDecision, useGuardedFormNavigation, type GuardedFormNavigationOptions } from "./useGuardedFormNavigation";

const mocks = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  unsaved: vi.fn(), project: vi.fn(), navigation: vi.fn(), dispose: vi.fn(),
  requestUnsaved: vi.fn(), capture: vi.fn(),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); },
}));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({
  useUnsavedChangesGuard: (dirty: boolean) => {
    mocks.unsaved(dirty);
    return { requestClose: mocks.requestUnsaved, dialog: "unsaved-dialog" };
  },
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useProjectChangeGuard: mocks.project }));
vi.mock("@/lib/navigationGuard", () => ({ installNavigationGuard: mocks.navigation }));
const navigator: Navigator = { createHref: () => "/", push: vi.fn(), replace: vi.fn(), go: vi.fn() };
function Harness(options: GuardedFormNavigationOptions) { mocks.capture(useGuardedFormNavigation(options)); return null; }
function render(options: GuardedFormNavigationOptions) {
  renderToStaticMarkup(createElement(UNSAFE_NavigationContext.Provider, {
    value: { navigator, basename: "/", static: true, future: {}, useTransitions: false },
  }, createElement(Harness, options)));
  return mocks.capture.mock.lastCall?.[0] as ReturnType<typeof useGuardedFormNavigation>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.effects = [];
  mocks.navigation.mockReturnValue(mocks.dispose);
  vi.stubGlobal("window", {});
});

describe("guardedFormNavigationDecision", () => {
  it.each([
    [false, false, "proceed", false, false],
    [true, false, "confirm", true, true],
    [false, true, "block", false, true],
    [true, true, "block", true, true],
  ] as const)("dirty=%s pending=%s preserves close, unload and route/project policy", (dirty, pending, close, beforeUnload, interceptNavigation) => {
    expect(guardedFormNavigationDecision({ dirty, pending })).toEqual({ close, beforeUnload, interceptNavigation });
    expect(guardedFormNavigationDecision({ active: false, dirty, pending })).toEqual({ close: "proceed", beforeUnload: false, interceptNavigation: false });
  });
  it("lets admin/settings retain their pending-only unload protection", () => {
    expect(guardedFormNavigationDecision({ dirty: true, pending: true }).beforeUnload).toBe(true);
  });
});

describe("useGuardedFormNavigation", () => {
  it("routes close, browser navigation and project changes through the same confirmation and disposes navigation", () => {
    const result = render({ dirty: true, pending: false });
    const proceed = vi.fn();
    result.requestClose(proceed);
    expect(mocks.requestUnsaved).toHaveBeenCalledWith(proceed);
    expect(mocks.unsaved).toHaveBeenCalledWith(true);
    expect(result.dialog).toBe("unsaved-dialog");
    expect(mocks.project).toHaveBeenCalledWith(true, result.requestClose);
    const dispose = mocks.effects[0]?.();
    expect(mocks.navigation).toHaveBeenCalledWith(navigator, result.requestClose, window, false);
    dispose?.();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
  it("blocks close and both navigation adapters during pending even for a clean draft", () => {
    const result = render({ dirty: false, pending: true });
    result.requestClose(vi.fn());
    expect(mocks.requestUnsaved).not.toHaveBeenCalled();
    expect(mocks.unsaved).toHaveBeenCalledWith(false);
    expect(mocks.project).toHaveBeenCalledWith(true, result.requestClose);
    mocks.effects[0]?.();
    expect(mocks.navigation).toHaveBeenCalledWith(navigator, result.requestClose, window, true);
  });
  it("does not install protection for a closed drawer", () => {
    const result = render({ active: false, dirty: true, pending: true });
    const proceed = vi.fn();
    result.requestClose(proceed);
    expect(mocks.requestUnsaved).toHaveBeenCalledWith(proceed);
    expect(mocks.unsaved).toHaveBeenCalledWith(false);
    expect(mocks.project).toHaveBeenCalledWith(false, result.requestClose);
    mocks.effects[0]?.();
    expect(mocks.navigation).not.toHaveBeenCalled();
  });
});
