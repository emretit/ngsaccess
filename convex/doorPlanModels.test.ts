import { describe, expect, it } from "vitest";
import {
  buildVerifySegments,
  normalizeVerifyPlan,
  holidayRanges,
} from "./lib/doorStatusPlan";
const verify = {
  enabled: true,
  beginTime: "08:00",
  endTime: "18:00",
  verifyMode: "card",
};
describe("door plan phase 2 models", () => {
  it("keeps empty days empty and legacy windows on every day", () => {
    expect(buildVerifySegments(verify)).toHaveLength(7);
    expect(buildVerifySegments({ ...verify, weekly: [] })).toEqual([]);
    const result = buildVerifySegments({
      ...verify,
      weekly: [
        {
          day: "Monday",
          segments: [
            { ...verify, verifyMode: "face" },
            {
              beginTime: "19:00:01",
              endTime: "20:00:02",
              verifyMode: "cardAndFace",
            },
          ],
        },
      ],
    });
    expect(result).toMatchObject([
      { id: 1, verifyMode: "face" },
      { id: 2, verifyMode: "faceAndCard", beginTime: "19:00:01" },
    ]);
  });
  it("rejects invalid, duplicate, overnight, overlapping and over-limit verify ranges", () => {
    for (const plan of [
      { ...verify, beginTime: "25:00" },
      { ...verify, beginTime: "20:00" },
      {
        ...verify,
        weekly: [
          { day: "Monday" as const, segments: [] },
          { day: "Monday" as const, segments: [] },
        ],
      },
      {
        ...verify,
        weekly: [{ day: "Monday" as const, segments: [verify, verify] }],
      },
      {
        ...verify,
        weekly: [
          {
            day: "Monday" as const,
            segments: Array.from({ length: 9 }, () => verify),
          },
        ],
      },
    ])
      expect(() => normalizeVerifyPlan(plan)).toThrow();
  });
  it("merges contiguous holiday dates and rejects capacity overflow", () => {
    expect(holidayRanges(["2026-01-02", "2026-01-01", "2026-01-01"])).toEqual([
      { beginDate: "2026-01-01", endDate: "2026-01-02" },
    ]);
    expect(() =>
      holidayRanges(
        Array.from({ length: 17 }, (_, i) =>
          new Date(Date.UTC(2026, 0, 1 + 2 * i)).toISOString().slice(0, 10),
        ),
      ),
    ).toThrow("16");
  });
  it("rejects impossible holiday dates with a readable error", () => {
    for (const date of ["2026-13-45", "2026-02-30", "26-01-01"])
      expect(() => holidayRanges([date])).toThrow("Geçersiz tatil tarihi");
  });
});
