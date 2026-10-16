import { afterEach, describe, expect, it, vi } from "vitest";
import { todayInTurkey, toLocalDateString } from "./date";

afterEach(() => vi.useRealTimers());

describe("todayInTurkey", () => {
  it("uses the next Turkey day after 21:00 UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T21:01:00Z"));
    expect(todayInTurkey()).toBe("2026-10-16");
  });
  it("uses the previous Turkey day before midnight and handles year boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T20:59:59Z"));
    expect(todayInTurkey()).toBe("2026-12-31");
    vi.setSystemTime(new Date("2026-12-31T21:00:00Z"));
    expect(todayInTurkey()).toBe("2027-01-01");
  });
  it("preserves the explicit local date formatter", () => {
    expect(toLocalDateString(new Date(2026, 0, 2))).toBe("2026-01-02");
  });
});
