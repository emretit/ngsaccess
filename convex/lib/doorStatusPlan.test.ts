import { describe, expect, it } from "vitest";
import {
  buildDoorStatusSegments,
  DOOR_STATUS_DAYS,
  normalizeDoorStatusPlan,
  type DoorStatusPlan,
} from "./doorStatusPlan";
const legacy: DoorStatusPlan = {
  enabled: true,
  beginTime: "08:00:00",
  endTime: "18:00:00",
  mode: "remainOpen",
};
const segment = {
  beginTime: "09:00",
  endTime: "12:00",
  mode: "normal" as const,
};
describe("buildDoorStatusSegments", () => {
  it("eski tek aralık koduyla birebir aynı yedi segmenti üretir", () => {
    expect(buildDoorStatusSegments(legacy)).toEqual(
      DOOR_STATUS_DAYS.map((week, index) => ({
        week,
        id: index + 1,
        enable: true,
        doorStatus: legacy.mode,
        beginTime: legacy.beginTime,
        endTime: legacy.endTime,
      })),
    );
  });
  it("haftalık günleri, sıraları, modları ve boş günleri korur", () => {
    expect(
      buildDoorStatusSegments({
        ...legacy,
        weekly: [
          {
            day: "Monday",
            segments: [
              segment,
              {
                ...segment,
                beginTime: "13:00:01",
                endTime: "18:00:02",
                mode: "remainClosed",
              },
            ],
          },
          { day: "Sunday", segments: [] },
        ],
      }),
    ).toEqual([
      {
        week: "Monday",
        id: 1,
        enable: true,
        doorStatus: "normal",
        beginTime: "09:00:00",
        endTime: "12:00:00",
      },
      {
        week: "Monday",
        id: 2,
        enable: true,
        doorStatus: "remainClosed",
        beginTime: "13:00:01",
        endTime: "18:00:02",
      },
    ]);
    expect(buildDoorStatusSegments({ ...legacy, weekly: [] })).toEqual([]);
  });
  it("eski okuyucular için ilk segmenti veya varsayılanları doldurur", () => {
    expect(
      normalizeDoorStatusPlan({
        ...legacy,
        weekly: [{ day: "Tuesday", segments: [segment] }],
      }),
    ).toMatchObject({
      beginTime: "09:00:00",
      endTime: "12:00:00",
      mode: "normal",
    });
    expect(normalizeDoorStatusPlan({ ...legacy, weekly: [] })).toMatchObject({
      beginTime: "08:00:00",
      endTime: "18:00:00",
      mode: "remainOpen",
    });
  });
  it.each(["24:00", "08:60", "8:00", "08:00:60", ""])(
    "geçersiz saati reddeder: %s",
    (beginTime) => {
      expect(() =>
        buildDoorStatusSegments({
          ...legacy,
          weekly: [{ day: "Monday", segments: [{ ...segment, beginTime }] }],
        }),
      ).toThrow("Saat");
    },
  );
  it.each(["12:00", "13:00"])("begin>=end reddeder: %s", (beginTime) => {
    expect(() =>
      buildDoorStatusSegments({
        ...legacy,
        weekly: [{ day: "Monday", segments: [{ ...segment, beginTime }] }],
      }),
    ).toThrow("Başlangıç");
  });
  it("sırasız çakışmayı, dokuz segmenti ve tekrar eden günü reddeder", () => {
    expect(() =>
      buildDoorStatusSegments({
        ...legacy,
        weekly: [
          {
            day: "Monday",
            segments: [{ ...segment, beginTime: "10:00" }, segment],
          },
        ],
      }),
    ).toThrow("çakışamaz");
    expect(() =>
      buildDoorStatusSegments({
        ...legacy,
        weekly: [
          { day: "Monday", segments: Array.from({ length: 9 }, () => segment) },
        ],
      }),
    ).toThrow("en fazla 8");
    expect(() =>
      buildDoorStatusSegments({
        ...legacy,
        weekly: [
          { day: "Monday", segments: [] },
          { day: "Monday", segments: [] },
        ],
      }),
    ).toThrow("en fazla bir kez");
  });
  it("bitişik sekiz aralığı kabul eder ve legacy saatleri doğrular", () => {
    expect(
      buildDoorStatusSegments({
        ...legacy,
        weekly: [
          {
            day: "Monday",
            segments: Array.from({ length: 8 }, (_, i) => ({
              ...segment,
              beginTime: `${String(i).padStart(2, "0")}:00`,
              endTime: `${String(i + 1).padStart(2, "0")}:00`,
            })),
          },
        ],
      }),
    ).toHaveLength(8);
    expect(() =>
      buildDoorStatusSegments({ ...legacy, beginTime: "18:00:00" }),
    ).toThrow("Başlangıç");
  });
});
