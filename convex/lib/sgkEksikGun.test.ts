import { describe, expect, it } from "vitest";
import { calculateSgkEksikGun, type SgkEksikGunInput } from "./sgkEksikGun";
import { buildAphbXml, SGK_EKSIK_GUN_KODU, sgkCodeForLeaveType } from "./sgkCodes";
import { trDateKey, trDayRangeISO } from "./trDate";

const WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const ALL_DAYS = ["Pazar", ...WEEKDAYS, "Cumartesi"];
const PAID_LEAVES = ["annual", "marriage", "bereavement", "paternity", "excuse", "compensatory", "lactation"];

function monthDays(year: number, month: number): string[] {
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length }, (_, day) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`,
  );
}

function calculate(overrides: Partial<SgkEksikGunInput> = {}) {
  return calculateSgkEksikGun({
    monthDays: ["2026-06-01"], // Pazartesi
    holidayMap: new Map(),
    workedDays: new Set(),
    approvedLeaves: [],
    ...overrides,
  });
}

function leave(leaveType: string, startDate = "2026-06-01", endDate = startDate) {
  return { leaveType, startDate, endDate };
}

describe("SGK eksik gün kodları", () => {
  it("resmi listedeki kodların tamamını, boşlukları koruyarak tanımlar", () => {
    expect(Object.values(SGK_EKSIK_GUN_KODU)).toEqual([
      "01", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13",
      "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29",
    ]);
    expect(SGK_EKSIK_GUN_KODU.GREV).toBe("08");
    expect(SGK_EKSIK_GUN_KODU.LOKAVT).toBe("09");
    expect(SGK_EKSIK_GUN_KODU.GENEL_HAYATI_ETKILEYEN_OLAYLAR).toBe("10");
    expect(SGK_EKSIK_GUN_KODU.DOGAL_AFET).toBe("11");
  });

  it.each(PAID_LEAVES)("%s ücretli izni eksik gün kodu üretmez", (type) => {
    expect(sgkCodeForLeaveType(type)).toBeNull();
    expect(calculate({ approvedLeaves: [leave(type)] })).toEqual({
      eksikGunSayisi: 0, eksikGunNedeni: null, primGunu: 30,
    });
  });

  it.each([["sick", "01"], ["parental", "01"], ["unpaid", "21"]])(
    "%s izni %s koduyla eksik gün oluşturur", (type, code) => {
      expect(sgkCodeForLeaveType(type)).toBe(code);
      expect(calculate({ approvedLeaves: [leave(type)] })).toEqual({
        eksikGunSayisi: 1, eksikGunNedeni: code, primGunu: 29,
      });
    },
  );
});

describe("aylık eksik gün hesabı", () => {
  it.each([[2026, 2, 28], [2028, 2, 29], [2026, 6, 30], [2026, 7, 31]])(
    "%i/%i (%i gün) tam ay çalışıldığında 30 prim günü üretir", (year, month, length) => {
      const days = monthDays(year, month);
      expect(days).toHaveLength(length);
      const workedDays = new Set(days.filter((day) => {
        const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
        return weekday >= 1 && weekday <= 5;
      }));
      expect(calculate({ monthDays: days, workedDays })).toEqual({
        eksikGunSayisi: 0, eksikGunNedeni: null, primGunu: 30,
      });
    },
  );

  it("izin ve okuma olmayan iş gününü 15 sayar", () => {
    expect(calculate()).toEqual({ eksikGunSayisi: 1, eksikGunNedeni: "15", primGunu: 29 });
  });

  it("hafta tatillerinde izin veya okuma aramaz", () => {
    expect(calculate({ monthDays: ["2026-06-06", "2026-06-07"] })).toEqual({
      eksikGunSayisi: 0, eksikGunNedeni: null, primGunu: 30,
    });
  });

  it.each([false, true])("UBGT (yarım gün=%s) eksik gün sayılmaz", (isHalfDay) => {
    expect(calculate({
      holidayMap: new Map([["2026-06-01", { isHalfDay }]]),
      approvedLeaves: [leave("unpaid")],
    })).toEqual({ eksikGunSayisi: 0, eksikGunNedeni: null, primGunu: 30 });
  });

  it("projenin özel çalışma günlerine uyar", () => {
    expect(calculate({
      monthDays: ["2026-06-01", "2026-06-06", "2026-06-07"],
      workingDays: ["Cumartesi"],
    })).toEqual({ eksikGunSayisi: 1, eksikGunNedeni: "15", primGunu: 29 });
  });

  it("boş çalışma günü ayarını Pazartesi–Cuma olarak kabul eder", () => {
    expect(calculate({ workingDays: [] })).toEqual(calculate({ workingDays: WEEKDAYS }));
  });

  it("okuma varsa ücretsiz izinden eksik gün oluşturmaz", () => {
    expect(calculate({ workedDays: new Set(["2026-06-01"]), approvedLeaves: [leave("unpaid")] }))
      .toEqual({ eksikGunSayisi: 0, eksikGunNedeni: null, primGunu: 30 });
  });

  it("rapor ve devamsızlık birlikte 12 kodunu oluşturur", () => {
    expect(calculate({ monthDays: ["2026-06-01", "2026-06-02"], approvedLeaves: [leave("sick")] }))
      .toEqual({ eksikGunSayisi: 2, eksikGunNedeni: "12", primGunu: 28 });
  });

  it("ücretsiz izin ve rapor birlikte 12 kodunu oluşturur", () => {
    expect(calculate({
      monthDays: ["2026-06-01", "2026-06-02"],
      approvedLeaves: [leave("unpaid"), leave("sick", "2026-06-02")],
    })).toEqual({ eksikGunSayisi: 2, eksikGunNedeni: "12", primGunu: 28 });
  });

  it("aynı kodu kullanan analık izni ve rapor 01 olarak kalır", () => {
    expect(calculate({
      monthDays: ["2026-06-01", "2026-06-02"],
      approvedLeaves: [leave("parental"), leave("sick", "2026-06-02")],
    })).toEqual({ eksikGunSayisi: 2, eksikGunNedeni: "01", primGunu: 28 });
  });

  it("ücretli izin, hafta tatili ve ay dışı izinler neden kümesine eklenmez", () => {
    expect(calculate({
      monthDays: ["2026-06-01", "2026-06-02", "2026-06-06"],
      approvedLeaves: [leave("annual"), leave("sick", "2026-06-06"), leave("unpaid", "2026-05-31")],
    })).toEqual({ eksikGunSayisi: 1, eksikGunNedeni: "15", primGunu: 29 });
  });

  it("ayı aşan izinleri yalnız ayın planlı günlerinde sayar", () => {
    expect(calculate({
      monthDays: monthDays(2026, 6),
      approvedLeaves: [leave("sick", "2026-05-01", "2026-07-31")],
    })).toEqual({ eksikGunSayisi: 22, eksikGunNedeni: "01", primGunu: 8 });
  });

  it("çakışan izinleri ve tekrar eden günleri yalnız bir kez sayar", () => {
    expect(calculate({
      monthDays: ["2026-06-01", "2026-06-01"],
      approvedLeaves: [leave("sick"), leave("sick")],
    })).toEqual({ eksikGunSayisi: 1, eksikGunNedeni: "01", primGunu: 29 });
  });

  it("çakışan ücretli izin günü primden düşürmez", () => {
    expect(calculate({ approvedLeaves: [leave("sick"), leave("annual")] })).toEqual({
      eksikGunSayisi: 0, eksikGunNedeni: null, primGunu: 30,
    });
  });

  it("31 eksik günde prim gününü sıfırda sınırlar", () => {
    expect(calculate({ monthDays: monthDays(2026, 7), workingDays: ALL_DAYS })).toEqual({
      eksikGunSayisi: 31, eksikGunNedeni: "15", primGunu: 0,
    });
  });

  it("UTC önceki ayın 21:00 okumasını Türkiye ayının ilk gününe yazar", () => {
    const { startISO, endISO } = trDayRangeISO("2026-06-01", "2026-06-30");
    expect(startISO).toBe("2026-05-31T21:00:00.000Z");
    expect(endISO).toBe("2026-06-30T20:59:59.999Z");
    expect(calculate({ workedDays: new Set([trDateKey(startISO)]) })).toEqual({
      eksikGunSayisi: 0, eksikGunNedeni: null, primGunu: 30,
    });
    expect(trDateKey("2026-06-30T21:00:00.000Z")).toBe("2026-07-01");
  });

  it("XML prim gününü ve eksik gün kodunu hesap sonucundan taşır", () => {
    const result = calculate({ approvedLeaves: [leave("unpaid")] });
    const xml = buildAphbXml({
      year: 2026, month: 6, companyName: "Deneme & Ortakları",
      employees: [{
        tcKimlikNo: "", adSoyad: "Örnek Çalışan", cumulativeWorkdays: result.primGunu,
        totalOvertimeHours: 0, eksikGunSayisi: result.eksikGunSayisi, eksikGunNedeni: result.eksikGunNedeni,
      }],
    });
    expect(xml).toContain("<calismaGunu>29</calismaGunu>");
    expect(xml).toContain("<eksikGunSayisi>1</eksikGunSayisi>");
    expect(xml).toContain("<eksikGunNedeni>21</eksikGunNedeni>");
    expect(xml).toContain("Deneme &amp; Ortakları");
  });
});
