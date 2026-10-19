import { describe, expect, it } from "vitest";
import { feedTimeTr, timeAgoTr } from "./relativeTime";

const now = Date.parse("2026-10-19T11:30:00.000Z"); // 14:30 İstanbul

describe("timeAgoTr", () => {
  it("formats minute, hour and day distances", () => {
    expect(timeAgoTr("2026-10-19T11:29:30.000Z", now)).toBe("şimdi");
    expect(timeAgoTr("2026-10-19T11:25:00.000Z", now)).toBe("5 dk önce");
    expect(timeAgoTr("2026-10-19T08:30:00.000Z", now)).toBe("3 sa önce");
    expect(timeAgoTr("2026-10-17T11:30:00.000Z", now)).toBe("2 gün önce");
  });

  it("treats future times as now and invalid input as null", () => {
    expect(timeAgoTr("2026-10-19T11:35:00.000Z", now)).toBe("şimdi");
    expect(timeAgoTr("nope", now)).toBeNull();
    expect(timeAgoTr(undefined, now)).toBeNull();
  });
});

describe("feedTimeTr", () => {
  it("is relative within the hour, clock time today and dated before today", () => {
    expect(feedTimeTr("2026-10-19T11:20:00.000Z", now)).toBe("10 dk önce");
    expect(feedTimeTr("2026-10-19T06:05:00.000Z", now)).toBe("09:05");
    // 18.10 23:50 İstanbul — UTC'de aynı gün olsa da İstanbul'da dün.
    expect(feedTimeTr("2026-10-18T20:50:00.000Z", now)).toBe("18.10.2026 23:50");
  });
});

describe("feed dates across years", () => {
  it("retains the year in old readings", () => {
    expect(feedTimeTr("2025-08-18T13:06:00Z", now)).toBe("18.08.2025 16:06");
    expect(feedTimeTr("invalid", now)).toBeNull();
  });
});
