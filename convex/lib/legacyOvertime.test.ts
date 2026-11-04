import { describe, expect, it } from "vitest";
import { legacyAttendanceDays } from "./legacyOvertime";

describe("legacy rapor bordro hücresi adaptörü", () => {
  it("yalnız devam kümesindeki günlerin bordro net süresini taşır; tekrar mola veya eşik uygulamaz", () => {
    expect([...legacyAttendanceDays([
      { date: "2026-06-01", totalMinutes: 540 },
      { date: "2026-06-02", totalMinutes: 480 },
      { date: "2026-06-03", totalMinutes: 0 },
    ], new Set(["2026-06-01", "2026-06-03"]))]).toEqual([["2026-06-01", 540], ["2026-06-03", 0]]);
  });
  it("eski istihdam kaydının devam gününü korur; ölçülemeyen süreyi uydurmaz", () => {
    expect([...legacyAttendanceDays([], new Set(["2026-06-01"]))]).toEqual([["2026-06-01", 0]]);
  });
});
