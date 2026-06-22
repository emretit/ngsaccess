import { describe, it, expect } from "vitest";
import {
  buildPeriodDateKeys,
  manualOverrideMinutes,
  minutesBetweenISO,
  computeLateMinutes,
  resolveDayStatus,
  matchEmployeeKey,
  formatIstanbulTime,
  formatHoursLabel,
} from "./pdksCalc";
import { DEFAULT_WORK_SETTINGS } from "./pdksHelpers";

describe("pdksCalc – buildPeriodDateKeys", () => {
  it("tek gün → tek anahtar", () => {
    expect(buildPeriodDateKeys("2026-06-22", "2026-06-22")).toEqual([
      "2026-06-22",
    ]);
  });

  it("ay geçişini doğru sayar (dahil aralık)", () => {
    expect(buildPeriodDateKeys("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  it("artık yıl 29 Şubat", () => {
    const keys = buildPeriodDateKeys("2024-02-28", "2024-03-01");
    expect(keys).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"]);
  });

  it("ters aralık → boş", () => {
    expect(buildPeriodDateKeys("2026-06-22", "2026-06-21")).toEqual([]);
  });
});

describe("pdksCalc – manualOverrideMinutes", () => {
  it("09:00–18:00 → 540 dk", () => {
    expect(manualOverrideMinutes("09:00", "18:00")).toBe(540);
  });

  it("çıkış girişten önce → 0'a kırpılır", () => {
    expect(manualOverrideMinutes("18:00", "09:00")).toBe(0);
  });

  it("eşit → 0", () => {
    expect(manualOverrideMinutes("12:30", "12:30")).toBe(0);
  });
});

describe("pdksCalc – minutesBetweenISO", () => {
  it("1 saat fark → 60", () => {
    expect(
      minutesBetweenISO(
        "2026-06-22T09:00:00.000Z",
        "2026-06-22T10:00:00.000Z",
      ),
    ).toBe(60);
  });

  it("floor uygular (kısmi dakika atılır)", () => {
    expect(
      minutesBetweenISO(
        "2026-06-22T09:00:00.000Z",
        "2026-06-22T09:01:59.000Z",
      ),
    ).toBe(1);
  });

  it("negatif fark kırpılmaz (çağıran sorumlu)", () => {
    expect(
      minutesBetweenISO(
        "2026-06-22T10:00:00.000Z",
        "2026-06-22T09:00:00.000Z",
      ),
    ).toBe(-60);
  });
});

describe("pdksCalc – computeLateMinutes", () => {
  it("isLate false → 0", () => {
    expect(
      computeLateMinutes("2026-06-22T07:00:00.000Z", false, DEFAULT_WORK_SETTINGS),
    ).toBe(0);
  });

  it("giriş yok → 0", () => {
    expect(computeLateMinutes(null, true, DEFAULT_WORK_SETTINGS)).toBe(0);
  });

  it("09:00 başlangıç + 15 tolerans; 09:30 TR girişi → 15 dk geç", () => {
    // 06:30Z = 09:30 TR → 570 dk; eşik 540+15=555 → 15
    expect(
      computeLateMinutes("2026-06-22T06:30:00.000Z", true, DEFAULT_WORK_SETTINGS),
    ).toBe(15);
  });

  it("tolerans içindeki değer (isLate yine de true gelse) negatif → 0", () => {
    // 06:05Z = 09:05 TR → 545; 545-555 = -10 → 0
    expect(
      computeLateMinutes("2026-06-22T06:05:00.000Z", true, DEFAULT_WORK_SETTINGS),
    ).toBe(0);
  });
});

describe("pdksCalc – resolveDayStatus (summary)", () => {
  const base = {
    mode: "summary" as const,
    classification: "workday" as const,
  };

  it("devam + zamanında → present", () => {
    expect(
      resolveDayStatus({ ...base, hasAttendance: true, hasLeave: false, isLate: false }),
    ).toBe("present");
  });

  it("devam + geç → late", () => {
    expect(
      resolveDayStatus({ ...base, hasAttendance: true, hasLeave: false, isLate: true }),
    ).toBe("late");
  });

  it("devamsız + izin → leave", () => {
    expect(
      resolveDayStatus({ ...base, hasAttendance: false, hasLeave: true, isLate: false }),
    ).toBe("leave");
  });

  it("devamsız + izin yok → absent", () => {
    expect(
      resolveDayStatus({ ...base, hasAttendance: false, hasLeave: false, isLate: false }),
    ).toBe("absent");
  });

  it("devam varken izin yok sayılır (present)", () => {
    expect(
      resolveDayStatus({ ...base, hasAttendance: true, hasLeave: true, isLate: false }),
    ).toBe("present");
  });

  it("summary hafta sonu/tatil ayırmaz → absent", () => {
    expect(
      resolveDayStatus({
        mode: "summary",
        classification: "weekend",
        hasAttendance: false,
        hasLeave: false,
        isLate: false,
      }),
    ).toBe("absent");
  });
});

describe("pdksCalc – resolveDayStatus (calendar)", () => {
  it("tatil + devam yok → holiday", () => {
    expect(
      resolveDayStatus({
        mode: "calendar",
        classification: "holiday",
        hasAttendance: false,
        hasLeave: false,
        isLate: false,
      }),
    ).toBe("holiday");
  });

  it("hafta sonu + devam yok → weekend", () => {
    expect(
      resolveDayStatus({
        mode: "calendar",
        classification: "weekend",
        hasAttendance: false,
        hasLeave: false,
        isLate: false,
      }),
    ).toBe("weekend");
  });

  it("hafta sonu çalışması (devam) hafta sonunu ezer → present", () => {
    expect(
      resolveDayStatus({
        mode: "calendar",
        classification: "weekend",
        hasAttendance: true,
        hasLeave: false,
        isLate: false,
      }),
    ).toBe("present");
  });

  it("tatilde izin → leave (devam yoksa izin tatili ezer)", () => {
    expect(
      resolveDayStatus({
        mode: "calendar",
        classification: "holiday",
        hasAttendance: false,
        hasLeave: true,
        isLate: false,
      }),
    ).toBe("leave");
  });

  it("iş günü + geç → late", () => {
    expect(
      resolveDayStatus({
        mode: "calendar",
        classification: "workday",
        hasAttendance: true,
        hasLeave: false,
        isLate: true,
      }),
    ).toBe("late");
  });
});

describe("pdksCalc – matchEmployeeKey", () => {
  const valid = new Set(["e1", "e2"]);
  const byCard = new Map([
    ["1234", "e2"],
  ]);

  it("geçerli employeeId → kendi anahtarı", () => {
    expect(matchEmployeeKey({ employeeId: "e1" }, valid, byCard)).toBe("e1");
  });

  it("geçersiz employeeId, cardNo eşleşir → kart sahibi", () => {
    expect(
      matchEmployeeKey({ employeeId: "ghost", cardNo: "1234" }, valid, byCard),
    ).toBe("e2");
  });

  it("hiçbiri eşleşmez → null", () => {
    expect(
      matchEmployeeKey({ employeeId: null, cardNo: "9999" }, valid, byCard),
    ).toBeNull();
  });

  it("employeeId önceliklidir (kart başkasınınki olsa da)", () => {
    expect(
      matchEmployeeKey({ employeeId: "e1", cardNo: "1234" }, valid, byCard),
    ).toBe("e1");
  });
});

describe("pdksCalc – formatIstanbulTime", () => {
  it("UTC'yi +3 İstanbul HH:MM'e çevirir", () => {
    // 06:30Z → 09:30 TR
    expect(formatIstanbulTime("2026-06-22T06:30:00.000Z")).toBe("09:30");
  });

  it("withSeconds → HH:MM:SS", () => {
    expect(formatIstanbulTime("2026-06-22T06:30:45.000Z", true)).toBe("09:30:45");
  });
});

describe("pdksCalc – formatHoursLabel", () => {
  it("540 dk → 9h 0m", () => {
    expect(formatHoursLabel(540)).toBe("9h 0m");
  });

  it("95 dk → 1h 35m", () => {
    expect(formatHoursLabel(95)).toBe("1h 35m");
  });

  it("0 dk → 0h 0m", () => {
    expect(formatHoursLabel(0)).toBe("0h 0m");
  });
});
