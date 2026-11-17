import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mainScrollTarget, rememberMainPosition, restoreMainPosition } from "@/components/Layout";

let mutationCallback: (() => void) | undefined;
let resizeCallback: (() => void) | undefined;
let frameCallback: FrameRequestCallback | undefined;
const disconnected = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  mutationCallback = undefined;
  resizeCallback = undefined;
  frameCallback = undefined;
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { mutationCallback = callback; }
    observe() {}
    disconnect = disconnected;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resizeCallback = callback; }
    observe() {}
    disconnect = disconnected;
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frameCallback = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function scroller() {
  let available = 0;
  const target = {
    scrollLeft: 0, scrollTop: 0, children: [], querySelector: vi.fn(() => null as Element | null),
    scrollTo: vi.fn(({ left = 0, top = 0 }: ScrollToOptions) => { target.scrollTop = Math.min(top, available); target.scrollLeft = left; }),
    addEventListener: vi.fn<(event: string, listener: () => void, options?: AddEventListenerOptions) => void>(), removeEventListener: vi.fn(),
    contains: vi.fn(() => true), getBoundingClientRect: () => ({ top: 20 }),
  };
  return { target, main: target as unknown as HTMLElement, grow: (height: number) => { available = height; } };
}
function flushFrame() { const callback = frameCallback; frameCallback = undefined; callback?.(0); }

it("resets pathname PUSH/REPLACE, preserves query changes, and restores POP by history key", () => {
  expect(mainScrollTarget("new", "PUSH", true, "").position?.top).toBe(0);
  expect(mainScrollTarget("new", "REPLACE", true, "").position?.top).toBe(0);
  expect(mainScrollTarget("query", "PUSH", false, "")).toEqual({});
  rememberMainPosition("entry-a", { left: 15, top: 900 });
  rememberMainPosition("entry-b", { left: 0, top: 200 });
  expect(mainScrollTarget("entry-a", "POP", true, "#row")).toEqual({ position: { left: 15, top: 900 } });
  expect(mainScrollTarget("entry-b", "POP", false, "").position?.top).toBe(200);
  expect(mainScrollTarget("anchor", "PUSH", false, "#row")).toEqual({ hash: "#row" });
});

it("bounds retained history entries", () => {
  for (let index = 0; index < 110; index++) rememberMainPosition(`bounded-${index}`, { left: 0, top: index });
  expect(mainScrollTarget("bounded-0", "POP", false, "")).toEqual({});
  expect(mainScrollTarget("bounded-109", "POP", false, "").position?.top).toBe(109);
});

it("waits for lazy/query content to grow instead of accepting an initially clamped POP position", () => {
  const { main, target, grow } = scroller();
  const restored = vi.fn();
  const stop = restoreMainPosition(main, { top: 900, left: 0 }, undefined, restored);
  expect(target.scrollTop).toBe(0);
  expect(restored).not.toHaveBeenCalled();
  grow(1200);
  mutationCallback?.();
  resizeCallback?.();
  flushFrame();
  expect(target.scrollTop).toBe(900);
  expect(restored).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  expect(frameCallback).toBeUndefined();
  stop();
});

it("cancels restoration on user input and bounds observers when content never arrives", () => {
  const { main, target } = scroller();
  const restored = vi.fn();
  restoreMainPosition(main, { top: 900, left: 0 }, undefined, restored);
  const listener = target.addEventListener.mock.calls.find(call => call[0] === "wheel")?.[1];
  if (typeof listener !== "function") throw new Error("Missing cancellation listener");
  listener();
  expect(restored).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  restoreMainPosition(main, { top: 900, left: 0 }, undefined, restored);
  vi.advanceTimersByTime(30_000);
  expect(restored).toHaveBeenCalledTimes(2);
  expect(disconnected).toHaveBeenCalled();
});

it("resolves delayed encoded hash targets within main without scrolling the window", () => {
  const { main, target, grow } = scroller();
  grow(1200);
  const getElementById = vi.fn(() => null as { getBoundingClientRect: () => { top: number } } | null);
  vi.stubGlobal("document", { getElementById });
  const restored = vi.fn();
  restoreMainPosition(main, undefined, "#ki%C5%9Fi", restored);
  expect(restored).not.toHaveBeenCalled();
  getElementById.mockReturnValue({ getBoundingClientRect: () => ({ top: 420 }) });
  mutationCallback?.(); flushFrame();
  expect(getElementById).toHaveBeenCalledWith("kişi");
  expect(target.scrollTop).toBe(400);
  expect(restored).toHaveBeenCalledOnce();
});

it("keeps window resets on public pathname navigation while preserving query/POP and shell ownership", async () => {
  const { scrollPublicRoute } = await import("@/App");
  const scrollTo = vi.fn();
  vi.stubGlobal("window", { scrollTo });
  const getElementById = vi.fn(() => null as HTMLElement | null);
  vi.stubGlobal("document", { getElementById, body: {} });
  scrollPublicRoute(true, "", "PUSH");
  scrollPublicRoute(true, "", "REPLACE");
  expect(scrollTo).toHaveBeenCalledTimes(2);
  scrollPublicRoute(false, "", "PUSH");
  scrollPublicRoute(true, "", "POP");
  getElementById.mockReturnValue({} as HTMLElement);
  scrollPublicRoute(true, "", "PUSH");
  expect(scrollTo).toHaveBeenCalledTimes(2);
});

it("waits for lazy public hash content and cleans up observers", async () => {
  const { scrollPublicRoute } = await import("@/App");
  const scrollIntoView = vi.fn();
  let loaded = false;
  vi.stubGlobal("document", { body: {}, getElementById: (id: string) => id === "section" && loaded ? { scrollIntoView } : null });
  const stop = scrollPublicRoute(true, "#section", "PUSH");
  expect(scrollIntoView).not.toHaveBeenCalled();
  loaded = true;
  mutationCallback?.();
  expect(scrollIntoView).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
  stop();
});

it("does not settle a small saved offset while lazy or query skeletons are still present", () => {
  const { main, target, grow } = scroller();
  grow(200);
  target.querySelector.mockReturnValue({} as Element);
  const restored = vi.fn();
  restoreMainPosition(main, { top: 80, left: 0 }, undefined, restored);
  expect(target.scrollTop).toBe(80);
  expect(restored).not.toHaveBeenCalled();
  // Loading content may temporarily shrink again before the full list arrives.
  grow(0); mutationCallback?.(); flushFrame();
  expect(restored).not.toHaveBeenCalled();
  grow(1000); target.querySelector.mockReturnValue(null);
  mutationCallback?.(); flushFrame();
  expect(target.scrollTop).toBe(80);
  expect(restored).toHaveBeenCalledOnce();
});
