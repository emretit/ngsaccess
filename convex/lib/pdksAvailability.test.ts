import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { PdksAvailableDates, pdksAvailableDateKeys, pdksDataPending, pdksFirstRecordDate } from "./pdksAvailability";
import { DEFAULT_WORK_SETTINGS, DEFAULT_OVERTIME_RATES } from "./pdksHelpers";
import { computePayrollCell } from "./pdksPayroll";
import { computeAttendanceDetailDay } from "./pdksDetail";
import { computePdksTableRow, classifyPdksDay } from "./pdksTable";
import { filterPdksReadings } from "./pdksSource";

const employee = { _id: "e", projectId: "p", cardNumber: "123" } as Doc<"employees">;
const reading = (date: string, mode = "card") => ({ employeeId: employee._id, projectId: employee.projectId, cardNo: "123", accessStatus: "izin_verildi", accessTime: `${date}T06:00:00Z`, hikCurrentVerifyMode: mode }) as Doc<"cardReadings">;
function context(rows: Doc<"cardReadings">[]) {
  const take = vi.fn(async (limit: number) => rows.slice(0, limit));
  const seen = vi.fn();
  const chain = { withIndex: () => chain, order: () => chain, take, async *[Symbol.asyncIterator]() { for (const row of rows) { seen(row); yield row; } } };
  return { ctx: { db: { query: () => chain } } as unknown as QueryCtx, take, seen };
}
describe("PDKS veri kapsamı", () => {
  it("yalnız geçerli proje olaylarının İstanbul günlerini kullanır", () => {
    const raw = [reading("2026-10-01", "face"), reading("2026-10-02", "unknown"), reading("2026-10-03"), { ...reading("2026-10-04"), projectId: "other" as Id<"projects"> }];
    expect([...pdksAvailableDateKeys(filterPdksReadings(raw, "p"))]).toEqual(["2026-10-01", "2026-10-03"]);
  });
  it("ilk biyometrik okumayı geçerli kayıt sayar; sorgu 20 ile sınırlıdır", async () => {
    const { ctx, take, seen } = context([reading("2026-10-01", "face"), reading("2026-10-03")]);
    expect(await pdksFirstRecordDate(ctx, employee, [])).toBe("2026-10-01");
    expect(take).not.toHaveBeenCalled();
    expect(seen).toHaveBeenCalledTimes(2);
  });
  it("20 adayın hiçbiri geçerli değilse dönem kaydına döner; kayıt yoksa bilinmeyen kalır", async () => {
    const { ctx } = context(Array.from({ length: 21 }, () => reading("2026-10-01", "unknown")));
    expect(await pdksFirstRecordDate(ctx, employee, [reading("2026-10-08")])).toBe("2026-10-08");
    expect(await pdksFirstRecordDate(ctx, employee, [])).toBeNull();
    expect(await pdksFirstRecordDate(ctx, employee, [], ["2026-10-02"])).toBe("2026-10-02");
  });
});

it("ilk kayıt için reddedilen deneme yerine izin verilen okumayı tercih eder", async () => {
  const denied = { ...reading("2026-10-01"), accessStatus: "reddedildi" as const };
  const granted = reading("2026-10-03");
  const { ctx } = context([denied, granted]);
  expect(await pdksFirstRecordDate(ctx, employee, [denied, granted])).toBe("2026-10-03");
  expect(await pdksFirstRecordDate(ctx, employee, [denied], ["2026-09-30"])).toBe("2026-09-30");
});
it("izin verilen aday yoksa dönem iznini tercih eder; hiç izin yoksa mevcut davranış sürer", async () => {
  const denied = { ...reading("2026-10-01"), accessStatus: "reddedildi" as const };
  const { ctx } = context([denied]);
  expect(await pdksFirstRecordDate(ctx, employee, [reading("2026-10-03")])).toBe("2026-10-03");
  expect(await pdksFirstRecordDate(ctx, employee, [denied])).toBe("2026-10-01");
});


describe("cihaz taraması tamamlanmadan devamsızlık üretilmez", () => {
  const date = "2026-11-17";
  const device = { _id: "d", _creationTime: 0, projectId: employee.projectId, brand: "hikvision", hikTransport: "gateway", isActive: true } as Doc<"devices">;
  const timing = { shift: null, shiftEnd: "18:00", earlyExitTolerance: 15 };
  const deadline = Date.parse(`${date}T18:15:00+03:00`);
  const classify = (devices: Doc<"devices">[], ownReadings: Doc<"cardReadings">[] = []) => {
    const dates = new PdksAvailableDates(pdksAvailableDateKeys([reading(date)]), devices, employee.projectId);
    return classifyPdksDay({ date, today: "2026-11-19", dataAvailable: dates.has(date),
      dataPending: pdksDataPending(dates, date, timing, ownReadings.length > 0), firstRecordDate: "2026-10-01",
      classification: "workday", hasAttendance: ownReadings.length > 0, hasLeave: false, isLate: false });
  };
  it("A okutunca, backfill tamamlanmamış günde B Veri bekleniyor olur", () => {
    expect(classify([device])).toBe("awaitingData");
    expect(classify([{ ...device, hikBackfillCursor: 999999, hikLastSeenAt: deadline + 1000 }])).toBe("awaitingData");
  });
  it("backfill tamamlandığında B Devamsız olur; boş tarama da yeterlidir", () => {
    expect(classify([{ ...device, hikLastBackfillAt: deadline }])).toBe("absent");
    expect(new PdksAvailableDates(new Set(), [device], employee.projectId).has(date)).toBe(true);
  });
  it("B kendi okutmasını yaptıysa etkilenmez", () => {
    expect(classify([device], [reading(date)])).toBe("present");
  });
  it("aktif her cihazın tolerans sonuna kadar taranmasını bekler", () => {
    expect(classify([{ ...device, hikLastBackfillAt: deadline }, { ...device, _id: "d2" as Id<"devices">, hikLastBackfillAt: deadline - 1 }])).toBe("awaitingData");
    expect(classify([{ ...device, isActive: false }])).toBe("absent");
  });
  it("örtüşen yarım pencere bekletir; sonraki pencere eski günü bekletmez", () => {
    const pending = { devIndex: "dev", searchID: "search", position: 0, startedAt: deadline + 1000, maxPages: 50, startTime: `${date}T00:00:00+03:00` };
    expect(classify([{ ...device, hikLastBackfillAt: deadline, hikBackfillPending: pending }])).toBe("awaitingData");
    expect(classify([{ ...device, hikLastBackfillAt: deadline, hikBackfillPending: { ...pending, startTime: new Date(deadline + 1).toISOString() } }])).toBe("absent");
  });
  it("gece vardiyası çıkış penceresini kapsar", () => {
    const shift = { startTime: "22:00", endTime: "06:00", validWindow: { checkOutEnd: "08:00", checkOutEndDayOffset: 1 } } as Doc<"shifts">;
    const dates = new PdksAvailableDates(new Set([date]), [{ ...device, hikLastBackfillAt: Date.parse("2026-11-18T07:59:00+03:00") }], employee.projectId);
    expect(pdksDataPending(dates, date, { ...timing, shift, shiftEnd: "06:00" }, false)).toBe(true);
  });
  it("devreye alma öncesi geçmiş ve takipsiz cihazlar eski davranışı korur", () => {
    expect(pdksDataPending(new PdksAvailableDates(new Set(), [device], employee.projectId), "2026-11-16", timing, false)).toBe(false);
    for (const dev of [{ ...device, brand: "ide_smart" as const }, { ...device, hikTransport: "localBridge" as const }, { ...device, brand: "other" as const }]) {
      expect(classify([dev])).toBe("absent");
    }
  });
});


describe("Veri bekleniyor tüm hesap yollarında aynı sonucu verir", () => {
  afterEach(() => vi.useRealTimers());
  it("tablo, detay, bordro: A'nın okutması B'yi devamsız yapmaz; tam tarama yapar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T12:00:00+03:00"));
    const date = "2026-11-17";
    const dayShift = { _id: "s", startTime: "09:00", endTime: "18:00" } as Doc<"shifts">;
    const device = { _id: "d", _creationTime: 0, projectId: employee.projectId, brand: "hikvision", hikTransport: "gateway" } as Doc<"devices">;
    const aReading = { ...reading(date), employeeId: "A" as Id<"employees">, cardNo: "A" };
    const outcomes = (completed: boolean, own = false, manualEntry = false, hasLeave = false) => {
      const availableDateKeys = new PdksAvailableDates(pdksAvailableDateKeys([aReading]), [{ ...device, ...(completed ? { hikLastBackfillAt: Date.parse("2026-11-18T12:00:00+03:00") } : {}) }], employee.projectId);
      const dayReadings = own ? [reading(date)] : [];
      const manual = manualEntry ? { employeeId: employee._id, date, entryTime: "09:00", exitTime: "18:00", manualEntry: true } as Doc<"pdksRecords"> : undefined;
      const leaves = hasLeave ? [{ employeeId: employee._id, startDate: date, endDate: date, status: "approved" } as Doc<"leaves">] : [];
      const common = { date, availableDateKeys, firstRecordDate: "2026-10-01", dayReadings, dayShift, holiday: null, workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: DEFAULT_OVERTIME_RATES };
      const payroll = computePayrollCell({ ...common, manual, hasLeave, empHourlyRate: null });
      const detail = computeAttendanceDetailDay({ ...common, manualDay: manual, leaves });
      const table = computePdksTableRow({ ...common, empKey: employee._id, employee, empReadings: dayReadings, departmentName: "", periodDateKeys: [date], startDate: date, isSingleDay: false, viewMode: "matrix", manualPdksByEmpDate: manual ? new Map([[`${employee._id}__${date}`, manual]]) : new Map(), allLeaves: leaves, holidayMap: new Map(), resolveShift: () => dayShift, manualEditedBy: null });
      return [table.days[0], payroll, detail];
    };
    for (const item of outcomes(false)) expect(item).toMatchObject({ status: "awaitingData", payrollCode: "—" });
    for (const item of outcomes(true)) expect(item).toMatchObject({ status: "absent", payrollCode: "DV" });
    for (const item of outcomes(false, true)) expect(item?.status).toBe("present");
    for (const item of outcomes(false, false, true)) expect(item?.status).toBe("present");
    for (const item of outcomes(false, false, false, true)) expect(item?.status).toBe("leave");
  });
});
