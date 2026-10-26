import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDeviceCommands } from "./useDeviceCommands";
const mocks = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void | (() => void))[],
  pending: false,
  action: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = value;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) => mocks.effects.push(effect),
}));
vi.mock("convex/react", () => ({ useAction: () => mocks.action }));
vi.mock("@/hooks/useAsyncAction", () => ({
  useAsyncAction: (action: (...args: unknown[]) => Promise<unknown>) => ({
    pending: mocks.pending,
    run: async (...args: unknown[]) => {
      await action(...args);
      return true;
    },
  }),
}));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));
const onPending = vi.fn();
let commands: ReturnType<typeof useDeviceCommands>;
function render() {
  mocks.cursor = 0;
  mocks.effects = [];
  function Harness() {
    commands = useDeviceCommands(
      {
        _id: "d" as Id<"devices">,
        name: "Panel",
        brand: "hikvision",
        hikTransport: "gateway",
      },
      onPending,
    );
    return null;
  }
  renderToStaticMarkup(<Harness />);
}
beforeEach(() => {
  mocks.cursor = 0;
  mocks.states = [];
  mocks.pending = false;
  vi.clearAllMocks();
  mocks.action.mockResolvedValue({ ok: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("olay tarama ve kart okutma onayı kabul edilene kadar komut göndermez", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));
  render();
  commands.handleBackfill();
  expect(mocks.action).not.toHaveBeenCalled();
  render();
  expect(commands.pendingAction?.id).toBe("backfillEvents");
  await commands.runConfirmed();
  expect(mocks.action).toHaveBeenCalledExactlyOnceWith({ deviceId: "d", startTime: "2026-10-25T12:00:00.000Z" });
  mocks.action.mockClear();
  commands.handleCaptureCard();
  render();
  expect(commands.pendingAction?.id).toBe("captureCard");
  expect(mocks.action).not.toHaveBeenCalled();
  await commands.runConfirmed();
  expect(mocks.action).toHaveBeenCalledOnce();
});
it("yeniden başlatma cihaz etkisini açıklayan yıkıcı onay açar", () => {
  render();
  commands.handleReboot();
  render();
  expect(commands.pendingAction?.destructive).toBe(true);
  expect(commands.pendingAction?.description).toContain("~30-60 sn çevrimdışı");
  expect(mocks.action).not.toHaveBeenCalled();
});
it("20 saniyeyi aşan komutta drawer kilidini kaldırır", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  mocks.pending = true;
  render();
  mocks.effects.forEach((effect) => effect());
  expect(onPending).toHaveBeenLastCalledWith(true);
  vi.advanceTimersByTime(19_999);
  render();
  expect(commands.longRunning).toBe(false);
  vi.advanceTimersByTime(1);
  render();
  expect(commands.longRunning).toBe(true);
  mocks.effects.forEach((effect) => effect());
  expect(onPending).toHaveBeenLastCalledWith(false);
});
