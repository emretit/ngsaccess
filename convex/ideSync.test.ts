import { describe, it, expect } from "vitest";
import {
  hhmmToMinutes,
  daysToIdeWeekDays,
  buildIdePermissionRecord,
  capPermissionNos,
  outOfRangeIoIds,
} from "./ideSync";

describe("ideSync – hhmmToMinutes", () => {
  it("HH:MM → dakika", () => {
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("08:00")).toBe(480);
    expect(hhmmToMinutes("18:00")).toBe(1080);
    expect(hhmmToMinutes("23:59")).toBe(1439);
    expect(hhmmToMinutes("9:30")).toBe(570); // tek haneli saat
  });
  it("geçersiz/eksik → null", () => {
    expect(hhmmToMinutes(undefined)).toBeNull();
    expect(hhmmToMinutes("")).toBeNull();
    expect(hhmmToMinutes("24:00")).toBeNull();
    expect(hhmmToMinutes("12:60")).toBeNull();
    expect(hhmmToMinutes("abc")).toBeNull();
  });
});

describe("ideSync – daysToIdeWeekDays", () => {
  it("boş/undefined → 7 gün açık (Hik deseni)", () => {
    expect(daysToIdeWeekDays(undefined)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(daysToIdeWeekDays([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it("EN gün adları → IDE numarası (0=Sunday)", () => {
    expect(daysToIdeWeekDays(["Monday", "Friday"])).toEqual([1, 5]);
    expect(daysToIdeWeekDays(["Sunday"])).toEqual([0]);
  });
  it("TR gün adları (büyük/küçük harf, türkçe karakter)", () => {
    expect(daysToIdeWeekDays(["Pazartesi", "Cuma"])).toEqual([1, 5]);
    expect(daysToIdeWeekDays(["çarşamba", "PERŞEMBE"])).toEqual([3, 4]);
    expect(daysToIdeWeekDays(["Cumartesi", "Pazar"])).toEqual([0, 6]);
  });
  it("tanınmayan günler atlanır, sıralı + tekil döner", () => {
    expect(daysToIdeWeekDays(["Monday", "xyz", "Monday"])).toEqual([1]);
  });
});

describe("ideSync – buildIdePermissionRecord", () => {
  it("tam kural → IDE permission record", () => {
    const rec = buildIdePermissionRecord(5, [0, 1], {
      startTime: "08:00",
      endTime: "18:00",
      days: ["Monday", "Tuesday"],
    });
    expect(rec).toEqual({
      id: 5,
      io: [0, 1],
      schedule: { start: 480, end: 1080, week_days: [1, 2] },
    });
  });
  it("io boşsa [0]'a düşer, saat boşsa 7/24", () => {
    const rec = buildIdePermissionRecord(3, [], {});
    expect(rec.io).toEqual([0]);
    expect(rec.schedule).toEqual({ start: 0, end: 1439, week_days: [0, 1, 2, 3, 4, 5, 6] });
  });
  it("io 0–7 dışını eler, 8 öğeye kırpar; hepsi geçersizse [0]", () => {
    // 8 ve -1 elenir; kalan [0..7] 8 öğe.
    expect(buildIdePermissionRecord(1, [0, 1, 2, 3, 4, 5, 6, 7, 8, -1], {}).io).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(buildIdePermissionRecord(1, [99, -3], {}).io).toEqual([0]);
  });
});

describe("ideSync – capPermissionNos", () => {
  it("tekilleştirir, sıralar, n<1'i eler", () => {
    expect(capPermissionNos([3, 1, 3, 2, 0, -5])).toEqual([1, 2, 3]);
  });
  it("üst sınıra (varsayılan 16) kırpar — küçükten büyüğe", () => {
    const many = Array.from({ length: 20 }, (_, i) => 20 - i); // 20..1
    expect(capPermissionNos(many)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
  });
  it("özel max ile kırpar", () => {
    expect(capPermissionNos([5, 4, 3, 2, 1], 2)).toEqual([1, 2]);
  });
  it("boş giriş → boş", () => {
    expect(capPermissionNos([])).toEqual([]);
  });
});

describe("ideSync – outOfRangeIoIds", () => {
  it("0–7 dışını döner (uyarı için)", () => {
    expect(outOfRangeIoIds([0, 1, 2, 3])).toEqual([]);
    expect(outOfRangeIoIds([0, 8, 10, -1, 2.5])).toEqual([8, 10, -1, 2.5]);
    expect(outOfRangeIoIds([])).toEqual([]);
  });
});
