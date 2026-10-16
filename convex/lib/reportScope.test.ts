import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { selectProjectScope } from "./projectScope";
import { reportPeriod, selectScheduleProjectIds } from "./reportScope";

describe("rapor proje kapsamı ve dönem", () => {
  it("seçili kapsamı izinli kümeyle doğrular; seçim yoksa yalnız erişilebilir projeleri döner", () => {
    const a = "a" as Id<"projects">;
    const b = "b" as Id<"projects">;
    expect(selectProjectScope([a, b], a)).toEqual([a]);
    expect(selectProjectScope([a, b])).toEqual([a, b]);
    expect(selectProjectScope([])).toEqual([]);
    expect(() => selectProjectScope([a], b)).toThrow("erişim yetkiniz yok");
  });
  it("zamanlamada güncel sahip rolünü, doğrulamayı ve geri alınan proje üyeliğini denetler", () => {
    const a = "a" as Id<"projects">;
    const b = "b" as Id<"projects">;
    const user: Doc<"users"> = { _id: "u" as Id<"users">, _creationTime: 0, role: "project_admin", verified: true };
    expect(selectScheduleProjectIds(user, [a, b], a)).toEqual([a]);
    expect(selectScheduleProjectIds(user, [a, b])).toEqual([a, b]);
    expect(selectScheduleProjectIds(user, [a], b)).toBeNull();
    expect(selectScheduleProjectIds({ ...user, role: "project_user" }, [a], a)).toBeNull();
    expect(selectScheduleProjectIds({ ...user, verified: false }, [a], a)).toBeNull();
    expect(selectScheduleProjectIds(null, [a], a)).toBeNull();
    expect(selectScheduleProjectIds(user, [])).toBeNull();
  });
  it("ay/yıl sınırlarını doğrular", () => {
    expect(reportPeriod(2024, 2)).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(reportPeriod(2026)).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
    for (const month of [0, 13, 1.5, NaN]) expect(() => reportPeriod(2026, month)).toThrow();
  });
});
