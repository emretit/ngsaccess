import { describe, expect, it, vi } from "vitest";
import type { Navigator } from "react-router-dom";
import { installNavigationGuard } from "./navigationGuard";

function setup(allowRequest = true) {
  const push = vi.fn();
  const replace = vi.fn();
  const go = vi.fn();
  const navigator: Navigator = { createHref: () => "/", go, push, replace };
  let listener: ((event: PopStateEvent) => void) | undefined;
  const history = { state: { idx: 3 }, go } as unknown as History;
  const browser: Pick<
    Window,
    "history" | "addEventListener" | "removeEventListener"
  > = {
    history,
    addEventListener: vi.fn((_name, callback) => {
      listener = callback as (event: PopStateEvent) => void;
    }),
    removeEventListener: vi.fn(),
  };
  let proceed: (() => void) | undefined;
  const request = vi.fn((next: () => void) => {
    if (allowRequest) proceed = next;
  });
  const cleanup = installNavigationGuard(navigator, request, browser);
  const pop = (idx: number) => {
    const stopImmediatePropagation = vi.fn();
    listener?.({
      state: { idx },
      stopImmediatePropagation,
    } as unknown as PopStateEvent);
    return stopImmediatePropagation;
  };
  return {
    navigator,
    push,
    replace,
    go,
    request,
    cleanup,
    pop,
    confirm: () => proceed?.(),
    browser,
  };
}
describe("admin navigation guard", () => {
  it("keeps route/tab navigation pending until confirmation and restores the adapter", () => {
    const state = setup();
    state.navigator.push("/system-admin?tab=projects");
    expect(state.push).not.toHaveBeenCalled();
    state.confirm();
    expect(state.push).toHaveBeenCalledWith("/system-admin?tab=projects");
    state.navigator.replace("/settings");
    expect(state.replace).not.toHaveBeenCalled();
    state.cleanup();
    expect(state.navigator.push).toBe(state.push);
    expect(state.navigator.replace).toBe(state.replace);
  });
  it("blocks navigation while a mutation is pending", () => {
    const state = setup(false);
    state.navigator.push("/home");
    state.confirm();
    expect(state.push).not.toHaveBeenCalled();
    state.cleanup();
  });
  it("restores the browser history before asking, then replays only the approved back navigation", () => {
    const state = setup();
    expect(state.pop(2)).toHaveBeenCalledOnce();
    expect(state.go).toHaveBeenLastCalledWith(1);
    expect(state.request).not.toHaveBeenCalled();
    expect(state.pop(3)).toHaveBeenCalledOnce();
    expect(state.request).toHaveBeenCalledOnce();
    state.confirm();
    expect(state.go).toHaveBeenLastCalledWith(-1);
    expect(state.pop(2)).not.toHaveBeenCalled();
    state.cleanup();
  });
  it("cancel leaves the current route mounted and forward traversal also asks", () => {
    const state = setup();
    state.pop(5);
    state.pop(3);
    expect(state.go).toHaveBeenCalledExactlyOnceWith(-2);
    state.confirm();
    expect(state.go).toHaveBeenLastCalledWith(2);
    state.cleanup();
  });
});

it.each([false, true])("restores originals when stacked guards are removed in either order (reverse=%s)", reverse => {
  const state = setup();
  const second = vi.fn((proceed: () => void) => proceed());
  const removeSecond = installNavigationGuard(state.navigator, second, state.browser);
  expect(state.browser.addEventListener).toHaveBeenCalledOnce();
  if (reverse) { removeSecond(); state.cleanup(); }
  else { state.cleanup(); removeSecond(); }
  expect(state.navigator.push).toBe(state.push);
  expect(state.navigator.replace).toBe(state.replace);
  expect(state.browser.removeEventListener).toHaveBeenCalledOnce();
  state.navigator.push("/home");
  expect(state.push).toHaveBeenCalledExactlyOnceWith("/home");
});

it("requires every mounted guard and ignores repeat approval", () => {
  const state = setup(false);
  let approve: (() => void) | undefined;
  const remove = installNavigationGuard(state.navigator, next => { approve = next; }, state.browser);
  state.navigator.push("/home");
  approve?.();
  expect(state.request).toHaveBeenCalledOnce();
  expect(state.push).not.toHaveBeenCalled();
  remove(); state.cleanup();
});

it("performs exactly one navigation after approval, including repeated clicks", () => {
  const state = setup();
  state.navigator.push("/home");
  state.confirm(); state.confirm();
  expect(state.push).toHaveBeenCalledExactlyOnceWith("/home");
  state.cleanup();
});

it("does not prompt any form when a lower guard is pending", () => {
  const state = setup();
  const remove = installNavigationGuard(state.navigator, () => undefined, state.browser, true);
  state.navigator.push("/home");
  expect(state.request).not.toHaveBeenCalled();
  expect(state.push).not.toHaveBeenCalled();
  remove(); state.cleanup();
});

it("checks guards installed while a confirmation is open", () => {
  const state = setup();
  state.navigator.push("/home");
  const remove = installNavigationGuard(state.navigator, () => undefined, state.browser, true);
  state.confirm();
  expect(state.push).not.toHaveBeenCalled();
  remove(); state.cleanup();
});

it("blocks a second back traversal after an approved traversal", () => {
  const state = setup();
  state.pop(2); state.pop(3); state.confirm(); state.pop(2);
  state.pop(1);
  expect(state.go).toHaveBeenLastCalledWith(1);
  state.pop(2);
  expect(state.request).toHaveBeenCalledTimes(2);
  state.cleanup();
});
