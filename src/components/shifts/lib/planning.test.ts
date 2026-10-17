import { describe, it, expect } from "vitest";
import {
  visibleRange,
  nextPeriod,
  istanbulToday,
  previewSummary,
  decisionTone,
  cellData,
  type Employee,
  type Shift,
  type Assignment,
} from "./planning";
import { bulkAssignmentFormSchema } from "../assignmentFormSchema";
const employee = {
  _id: "e1",
  projectId: "p1",
  firstName: "Ayşe",
  lastName: "Demir",
} as Employee;
const shift = (id: string, startTime: string, endTime: string) =>
  ({ _id: id, name: id, startTime, endTime }) as Shift;
const assignment = (
  id: string,
  shiftId: string,
  startDate: string,
  endDate = startDate,
  weekPattern?: string[],
) =>
  ({
    _id: id,
    employeeId: "e1",
    shiftId,
    startDate,
    endDate,
    weekPattern,
  }) as Assignment;
describe("Görünür vardiya aralığı", () => {
  it("yıl sınırındaki haftayı pazartesiden başlatır", () =>
    expect(visibleRange("2026-01-01", "week")).toMatchObject({
      rangeStart: "2025-12-29",
      rangeEnd: "2026-01-04",
    }));
  it("artık yıl ve ay uzunluklarını korur", () => {
    expect(visibleRange("2024-02-29", "month").days).toHaveLength(29);
    expect(visibleRange("2026-02-14", "month").days).toHaveLength(28);
  });
  it("ay sonunda sonraki ayı atlamaz", () =>
    expect(nextPeriod("2026-01-31", "month", 1)).toBe("2026-02-01"));
  it("mobil yalnız seçilen günü ister", () =>
    expect(visibleRange("2026-10-19", "day").days).toEqual(["2026-10-19"]));
  it("İstanbul gününü UTC gece sınırında kullanır", () =>
    expect(istanbulToday(new Date("2026-10-18T21:15:00Z"))).toBe("2026-10-19"));
});
describe("Atama önizleme doğrulaması", () => {
  const values = {
    employeeIds: ["e1"],
    shiftId: "s1",
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    specificDays: false,
    weekPattern: [],
  };
  it("365 tarih farkını kabul eder; 366 farkı reddeder", () => {
    expect(bulkAssignmentFormSchema.safeParse(values).success).toBe(true);
    expect(
      bulkAssignmentFormSchema.safeParse({ ...values, endDate: "2027-01-02" })
        .success,
    ).toBe(false);
  });
  it("belirli günlerde boş desen ve 101 kişi reddedilir", () => {
    expect(
      bulkAssignmentFormSchema.safeParse({ ...values, specificDays: true })
        .success,
    ).toBe(false);
    expect(
      bulkAssignmentFormSchema.safeParse({
        ...values,
        employeeIds: Array.from({ length: 101 }, (_, i) => String(i)),
      }).success,
    ).toBe(false);
  });
  it("geçersiz takvim ve ters aralık reddedilir", () => {
    expect(
      bulkAssignmentFormSchema.safeParse({ ...values, startDate: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      bulkAssignmentFormSchema.safeParse({ ...values, endDate: "2025-12-31" })
        .success,
    ).toBe(false);
  });
  it("sıfır başarıyı başarı olarak renklendirmez ve bütün ana kararları özetler", () => {
    expect(decisionTone("failed")).toBe("warning");
    expect(
      previewSummary({
        total: 5,
        willAssign: 1,
        conflict: 1,
        onLeave: 1,
        holiday: 1,
        skipped: 1,
      }),
    ).toContain("1 izin, 1 tatil, 1 atlanacak");
  });
});
describe("Ortak ajanda ve tablo gün modeli", () => {
  it("gece devamını yeni başlangıçtan ayırır", () => {
    const data = cellData(
      employee,
      "2026-10-20",
      [assignment("a", "night", "2026-10-19")],
      [shift("night", "22:00", "06:00")],
      [],
      [],
    );
    expect(data.records[0]?.continuation).toBe(true);
  });
  it("aynı günde ayrık vardiyalar çakışma değildir", () => {
    const data = cellData(
      employee,
      "2026-10-19",
      [
        assignment("a", "am", "2026-10-19"),
        assignment("b", "pm", "2026-10-19"),
      ],
      [shift("am", "08:00", "12:00"), shift("pm", "12:00", "17:00")],
      [],
      [],
    );
    expect(data.conflict).toBe(false);
  });
  it("gece devamındaki gerçek saat kesişmesini gösterir", () => {
    const data = cellData(
      employee,
      "2026-10-20",
      [
        assignment("a", "night", "2026-10-19"),
        assignment("b", "am", "2026-10-20"),
      ],
      [shift("night", "22:00", "06:00"), shift("am", "05:00", "09:00")],
      [],
      [],
    );
    expect(data.conflict).toBe(true);
  });
  it("önceki gündeki çakışmayı bugüne taşımaz", () => {
    const data = cellData(
      employee,
      "2026-10-20",
      [
        assignment("a", "night", "2026-10-19"),
        assignment("b", "night2", "2026-10-19"),
      ],
      [shift("night", "22:00", "02:00"), shift("night2", "23:00", "00:00")],
      [],
      [],
    );
    expect(data.records).toHaveLength(1);
    expect(data.conflict).toBe(false);
  });
});
