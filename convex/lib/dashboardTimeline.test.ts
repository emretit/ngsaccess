import { describe, expect, it } from "vitest";
import { createHourlyCounter } from "./dashboardTimeline";

function hourlyReadingCounts(readings: Parameters<ReturnType<typeof createHourlyCounter>["add"]>[0][]) {
  const counter = createHourlyCounter();
  for (const reading of readings) counter.add(reading);
  return counter.result();
}

describe("createHourlyCounter", () => {
  it("buckets readings by Istanbul hour and splits granted/denied", () => {
    const result = hourlyReadingCounts([
      { accessTime: "2026-10-19T05:55:00.000Z", accessStatus: "izin_verildi" }, // 08:55 TR
      { accessTime: "2026-10-19T05:59:59.000Z", accessStatus: "reddedildi" }, // 08:59 TR
      { accessTime: "2026-10-19T06:00:00.000Z", accessStatus: "izin_verildi" }, // 09:00 TR
      { accessTime: "2026-10-18T21:30:00.000Z", accessStatus: "izin_verildi" }, // 00:30 TR
    ]);
    expect(result.hours).toHaveLength(24);
    expect(result.hours[8]).toEqual({ hour: 8, granted: 1, denied: 1 });
    expect(result.hours[9]).toEqual({ hour: 9, granted: 1, denied: 0 });
    expect(result.hours[0]).toEqual({ hour: 0, granted: 1, denied: 0 });
    expect(result).toMatchObject({ granted: 3, denied: 1, total: 4 });
  });

  it("counts unknown status only in the total and skips invalid times", () => {
    const result = hourlyReadingCounts([
      { accessTime: "2026-10-19T07:00:00.000Z" },
      { accessTime: "not-a-date", accessStatus: "izin_verildi" },
    ]);
    expect(result).toMatchObject({ granted: 0, denied: 0, total: 1 });
    expect(result.hours[10]).toEqual({ hour: 10, granted: 0, denied: 0 });
  });
});
