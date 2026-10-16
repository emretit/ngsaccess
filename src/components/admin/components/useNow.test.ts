import { afterEach, describe, expect, it, vi } from "vitest";
import { startVisibleClock } from "../../../hooks/useNow";
import {
  computeDeviceStatus,
  DEVICE_ONLINE_WINDOW_MS,
} from "../../../lib/deviceStatus";

class TestVisibilitySource extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
}

describe("görünür cihaz saati", () => {
  afterEach(() => vi.useRealTimers());
  it("beş dakika eşiğinde reaktif veriye gerek olmadan çevrimdışı olur", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T09:00:00Z"));
    const lastSeen = new Date().toISOString();
    const source = new TestVisibilitySource();
    let status = "offline";
    const stop = startVisibleClock(source, (now) => {
      status = computeDeviceStatus(lastSeen, now);
    });
    expect(status).toBe("online");
    vi.advanceTimersByTime(DEVICE_ONLINE_WINDOW_MS - 30_000);
    expect(status).toBe("online");
    vi.advanceTimersByTime(30_000);
    expect(status).toBe("offline");
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("gizliyken durur, görünür olunca hemen günceller", () => {
    vi.useFakeTimers();
    const source = new TestVisibilitySource();
    const tick = vi.fn();
    const stop = startVisibleClock(source, tick);
    expect(tick).toHaveBeenCalledTimes(1);
    source.visibilityState = "hidden";
    source.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(600_000);
    expect(tick).toHaveBeenCalledTimes(1);
    source.visibilityState = "visible";
    source.dispatchEvent(new Event("visibilitychange"));
    expect(tick).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
