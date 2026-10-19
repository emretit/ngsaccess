import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTrDate, formatTrDateTime, todayInTurkey, toLocalDateString } from "./date";

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

describe("Turkey display formatters", () => {
  it("formats a date and timestamp with two-digit date and time fields", () => {
    const date = new Date("2026-10-19T15:20:07Z");
    expect(formatTrDateTime(date)).toBe("19.10.2026 18:20");
    expect(formatTrDateTime(date.getTime(), { seconds: true })).toBe("19.10.2026 18:20:07");
    expect(formatTrDateTime(date, { seconds: false })).toBe("19.10.2026 18:20");
    expect(formatTrDate(date)).toBe("19.10.2026");
    expect(formatTrDate(date.getTime())).toBe("19.10.2026");
  });

  it("rolls UTC 21:30 into the next Turkey day", () => {
    const date = new Date("2026-10-19T21:30:00Z");
    expect(formatTrDateTime(date)).toBe("20.10.2026 00:30");
    expect(formatTrDate(date)).toBe("20.10.2026");
  });

  it("pads single-digit fields and rolls across year boundaries", () => {
    expect(formatTrDateTime(new Date("2026-12-31T21:05:09Z"), { seconds: true })).toBe("01.01.2027 00:05:09");
  });
});
