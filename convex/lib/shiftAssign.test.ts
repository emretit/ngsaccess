import { describe, expect, it, vi } from "vitest";
import type { RegisteredMutation, RegisteredQuery } from "convex/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import * as shifts from "../shifts";
import type { Id } from "../_generated/dataModel";
import { assignmentIntersectsRange, evaluateShiftAssignment, shiftDateOffset, validateAssignRange, type ExistingShiftAssignment } from "./shiftAssign";

const day = { startTime: "09:00", endTime: "18:00" };
const night = { startTime: "22:00", endTime: "06:00" };
const range = { startDate: "2026-10-19", endDate: "2026-10-25", weekPattern: ["MON", "FRI"] };
const base = { range, shift: day, existing: [], leaves: [], holidays: [] };
const leave = { _id: "leave" as Id<"leaves">, status: "approved" as const, startDate: "2026-10-21", endDate: "2026-10-21", leaveType: "annual" as const };
const holiday = { _id: "holiday" as Id<"holidays">, date: "2026-10-21", name: "Tatil", isHalfDay: false };
function existing(override: Partial<ExistingShiftAssignment> = {}): ExistingShiftAssignment {
  return { ...range, assignmentId: "assignment" as Id<"shiftAssignments">, shiftId: "shift" as Id<"shifts">, shiftName: "Gündüz", shift: day, ...override };
}

describe("vardiya atama kararı", () => {
  it("SHF-UI-20: Pzt/Cum atamasında Çar izni ve tatili engellemez", () => {
    expect(evaluateShiftAssignment({ ...base, leaves: [leave], holidays: [holiday] })).toMatchObject({ status: "will_assign", occurrenceCount: 2, leave: null, holiday: null });
  });
  it("yalnız onaylı ve fiili günle kesişen izni engeller", () => {
    const monday = { ...leave, startDate: "2026-10-19", endDate: "2026-10-19" };
    expect(evaluateShiftAssignment({ ...base, leaves: [monday] })).toMatchObject({ status: "on_leave", leave: { date: "2026-10-19" } });
    for (const status of ["pending", "rejected"] as const) {
      expect(evaluateShiftAssignment({ ...base, leaves: [{ ...monday, status }] }).status).toBe("will_assign");
    }
  });
  it("gecenin izin/tatil taşıdığı ertesi günü kontrol eder", () => {
    const request = { ...base, shift: night, range: { startDate: "2026-10-20", endDate: "2026-10-20", weekPattern: ["TUE"] } };
    expect(evaluateShiftAssignment({ ...request, leaves: [leave] }).status).toBe("on_leave");
    expect(evaluateShiftAssignment({ ...request, holidays: [holiday] }).status).toBe("holiday");
    expect(evaluateShiftAssignment({ ...request, holidays: [holiday], calendarConfirmed: true })).toMatchObject({ status: "will_assign", holiday: { date: "2026-10-21" } });
  });
  it("00:00 bitişi ertesi güne taşmış çalışma saymaz", () => {
    expect(evaluateShiftAssignment({ ...base, shift: { startTime: "22:00", endTime: "00:00" }, range: { startDate: "2026-10-20", endDate: "2026-10-20" }, leaves: [leave] }).status).toBe("will_assign");
  });
  it("çakışan atamanın kimliğini/saatini döner ve iki onayı ayrı tutar", () => {
    const request = { ...base, existing: [existing()], leaves: [{ ...leave, startDate: "2026-10-19", endDate: "2026-10-19" }] };
    expect(evaluateShiftAssignment(request)).toMatchObject({ status: "on_leave", conflict: { assignmentId: "assignment", startTime: "09:00" } });
    expect(evaluateShiftAssignment({ ...request, calendarConfirmed: true }).status).toBe("conflict");
    expect(evaluateShiftAssignment({ ...request, forceConfirm: true }).status).toBe("on_leave");
    expect(evaluateShiftAssignment({ ...request, calendarConfirmed: true, forceConfirm: true }).status).toBe("will_assign");
  });
  it("ayrı saat, farklı desen ve sınırda bitiş çakışmaz", () => {
    for (const other of [existing({ weekPattern: ["WED"] }), existing({ shift: { startTime: "18:00", endTime: "22:00" } }), existing({ endDate: "2026-10-18" })]) {
      expect(evaluateShiftAssignment({ ...base, existing: [other] }).status).toBe("will_assign");
    }
  });
  it("önceki gün gece devamı ve sonraki gün erken vardiyası çakışır", () => {
    expect(evaluateShiftAssignment({ ...base, range: { startDate: "2026-10-20", endDate: "2026-10-20" }, shift: { startTime: "05:00", endTime: "08:00" }, existing: [existing({ startDate: "2026-10-19", endDate: "2026-10-19", shift: night })] }).status).toBe("conflict");
    expect(evaluateShiftAssignment({ ...base, shift: night, range: { startDate: "2026-10-19", endDate: "2026-10-19" }, existing: [existing({ startDate: "2026-10-20", endDate: "2026-10-20", weekPattern: ["TUE"], shift: { startTime: "05:00", endTime: "08:00" } })] }).status).toBe("conflict");
  });
  it("eşleşmeyen desen ve pasif tanım için sebep verir", () => {
    expect(evaluateShiftAssignment({ ...base, range: { startDate: "2026-10-20", endDate: "2026-10-20", weekPattern: ["MON"] } })).toMatchObject({ status: "skipped", occurrenceCount: 0 });
    expect(evaluateShiftAssignment({ ...base, shift: { ...day, isActive: false } }).status).toBe("skipped");
    expect(() => validateAssignRange({ ...range, weekPattern: ["BAD"] })).toThrow();
  });
  it("eski boş desen her gün anlamını korur; uzun mevcut seriyi kırpar", () => {
    expect(evaluateShiftAssignment({ ...base, range: { ...range, weekPattern: [] } }).occurrenceCount).toBe(7);
    expect(evaluateShiftAssignment({ ...base, existing: [existing({ startDate: "2000-01-01", endDate: "2099-12-31" })] }).status).toBe("conflict");
  });
  it("apply yeniden hesapladığında önizleme sonrası gelen atamayı görür", () => {
    expect(evaluateShiftAssignment(base).status).toBe("will_assign");
    expect(evaluateShiftAssignment({ ...base, existing: [existing()] }).status).toBe("conflict");
  });
});

describe("görünür vardiya aralığı", () => {
  it("önceki gün gecesini kapsar; önceki gündüzü ve bitmiş seriyi dışlar", () => {
    const series = { startDate: "2026-10-19", endDate: "2026-10-19", weekPattern: ["MON"] };
    expect(assignmentIntersectsRange(series, night, "2026-10-20", "2026-10-20")).toBe(true);
    expect(assignmentIntersectsRange(series, day, "2026-10-20", "2026-10-20")).toBe(false);
    expect(assignmentIntersectsRange(series, night, "2026-10-21", "2026-10-21")).toBe(false);
    expect(assignmentIntersectsRange({ ...series, weekPattern: ["TUE"] }, night, "2026-10-20", "2026-10-20")).toBe(false);
  });
  it("gece 00:00 sınırı ve ay/yıl değişiminde doğru kesişir", () => {
    expect(assignmentIntersectsRange({ startDate: "2026-12-31", endDate: "2026-12-31" }, night, "2027-01-01", "2027-01-01")).toBe(true);
    expect(assignmentIntersectsRange({ startDate: "2026-12-31", endDate: "2026-12-31" }, { startTime: "22:00", endTime: "00:00" }, "2027-01-01", "2027-01-01")).toBe(false);
    expect(shiftDateOffset("2024-03-01", -1)).toBe("2024-02-29");
  });
});

// Exercise the registered handler logic with a deterministic in-memory adapter.
// No Convex runtime, network request, installed package or persistent DB write.
vi.mock("./customFunctions", () => {
  const register = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return { authedQuery: register, authedMutation: register };
});
vi.mock("./auth", () => ({ getProjectIdsForUser: async () => ["project"] }));

function registeredHandler<Args extends Record<string, unknown>, Result>(fn: RegisteredQuery<"public", Args, Result> | RegisteredMutation<"public", Args, Result>) {
  return (fn as unknown as { _handler: (ctx: QueryCtx | MutationCtx, args: Args) => Result })._handler;
}
const handlers = {
  previewBulkAssign: registeredHandler(shifts.previewBulkAssign),
  bulkAssignShift: registeredHandler(shifts.bulkAssignShift),
  listAssignments: registeredHandler(shifts.listAssignments),
  assignmentDeleteImpact: registeredHandler(shifts.assignmentDeleteImpact),
  definitionUsage: registeredHandler(shifts.definitionUsage),
  definitionImpacts: registeredHandler(shifts.definitionImpacts),
  remove: registeredHandler(shifts.remove),
  updateAssignment: registeredHandler(shifts.updateAssignment),
};
type MemoryRow = Record<string, unknown>;
function memoryContext(seed: Record<string, MemoryRow[]>) {
  const tables = new Map(Object.entries(seed).map(([name, rows]) => [name, [...rows]]));
  const reads: { table: string; index: string; limit: number | null }[] = [];
  let writes = 0;
  function query(table: string) {
    const predicates: ((row: MemoryRow) => boolean)[] = [];
    let index = "";
    const valueOf = (value: unknown) => typeof value === "string" ? value : "";
    const bounds = {
      eq(field: string, value: unknown) { predicates.push(row => row[field] === value); return bounds; },
      gte(field: string, value: unknown) { predicates.push(row => valueOf(row[field]) >= valueOf(value)); return bounds; },
      lte(field: string, value: unknown) { predicates.push(row => valueOf(row[field]) <= valueOf(value)); return bounds; },
    };
    const result = {
      withIndex(name: string, callback: (q: typeof bounds) => unknown) { index = name; callback(bounds); return result; },
      async take(limit: number) { reads.push({ table, index, limit }); return (tables.get(table) ?? []).filter(row => predicates.every(predicate => predicate(row))).slice(0, limit); },
      async collect() { reads.push({ table, index, limit: null }); return (tables.get(table) ?? []).filter(row => predicates.every(predicate => predicate(row))); },
    };
    return result;
  }
  const db = {
    query,
    async get(id: string) { return [...tables.values()].flat().find(row => row._id === id) ?? null; },
    async insert(table: string, row: MemoryRow) {
      const rows = tables.get(table) ?? [];
      const id = `new-${++writes}`;
      rows.push({ ...row, _id: id }); tables.set(table, rows); return id;
    },
    async delete(id: string) {
      writes++;
      for (const rows of tables.values()) { const i = rows.findIndex(row => row._id === id); if (i >= 0) rows.splice(i, 1); }
    },
    async patch(id: string, patch: MemoryRow) {
      const row = [...tables.values()].flat().find(item => item._id === id);
      if (!row) throw new Error("Missing fixture");
      writes++; Object.assign(row, patch);
    },
  };
  return { queryCtx: { db, user: { _id: "admin", role: "super_admin" } } as unknown as QueryCtx, mutationCtx: { db, user: { _id: "admin", role: "super_admin" } } as unknown as MutationCtx,
    reads, tables, writes: () => writes };
}
const projectId = "project" as Id<"projects">;
const employeeId = "employee" as Id<"employees">;
const shiftId = "shift" as Id<"shifts">;
const bulkInput = { projectId, employeeIds: [employeeId], shiftId, startDate: "2026-10-19", endDate: "2026-10-19" };
const employeeRow = { _id: employeeId, projectId, firstName: "Ada", lastName: "Kaya" };
const shiftRow = { _id: shiftId, projectId, name: "Gündüz", ...day, isActive: true };
const assignmentRow = { _id: "assignment", employeeId, shiftId, projectId, startDate: "2026-10-19", endDate: "2026-10-19" };
function seedMemory(overrides: Record<string, MemoryRow[]> = {}) {
  return memoryContext({ employees: [employeeRow], shifts: [shiftRow], shiftAssignments: [], leaves: [], holidays: [], ...overrides });
}

describe("vardiya endpoint sözleşmeleri", () => {
  it("düzenleme fiili gün kuralını kullanır; kendi serisini dışlar", async () => {
    const memory = seedMemory({ leaves: [{ ...leave, employeeId }], shiftAssignments: [assignmentRow] });
    await expect(handlers.updateAssignment(memory.mutationCtx, { assignmentId: "assignment" as Id<"shiftAssignments">, ...range })).resolves.toBeUndefined();
    expect(memory.tables.get("shiftAssignments")?.[0]).toMatchObject(range);
  });
  it("preview bitiş verilmezse başlangıç gününü kullanır; global tatili de okur", async () => {
    const memory = seedMemory({ holidays: [{ ...holiday, date: bulkInput.startDate }] });
    const { endDate: _end, ...input } = bulkInput;
    const preview = await handlers.previewBulkAssign(memory.queryCtx, input);
    expect(preview.results[0]).toMatchObject({ status: "holiday", occurrenceCount: 1 });
  });
  it("önizleme salt okunur; aynı kişi için sonraki apply güncel çakışmayı döner", async () => {
    const memory = seedMemory();
    const preview = await handlers.previewBulkAssign(memory.queryCtx, bulkInput);
    expect(preview.summary).toEqual({ total: 1, willAssign: 1, conflict: 0, onLeave: 0, holiday: 0, skipped: 0 });
    expect(memory.writes()).toBe(0);
    memory.tables.set("shiftAssignments", [assignmentRow]);
    const apply = await handlers.bulkAssignShift(memory.mutationCtx, { ...bulkInput, resultMode: "detailed" });
    expect(apply).toMatchObject({ insertedCount: 0, overlapCount: 1, results: [{ status: "skipped_conflict", assignmentId: null }] });
    expect(memory.writes()).toBe(0);
  });
  it("çakışanı atlayıp diğerini yazar; eski sonuç alanlarını korur", async () => {
    const otherId = "other" as Id<"employees">;
    const memory = seedMemory({ employees: [employeeRow, { ...employeeRow, _id: otherId }], shiftAssignments: [assignmentRow] });
    const result = await handlers.bulkAssignShift(memory.mutationCtx, { ...bulkInput, employeeIds: [employeeId, otherId] });
    expect(result).toMatchObject({ insertedCount: 1, overlapCount: 1, skipped: [{ employeeId }], results: [{ status: "skipped_conflict" }, { status: "assigned", assignmentId: "new-1" }] });
    expect(memory.tables.get("shiftAssignments")?.slice(-1)[0]).toMatchObject({ employeeId: otherId, projectId });
  });
  it("izin, tatil ve erişim hatasını kişi bazında açıklayıp açık onayı uygular", async () => {
    const memory = seedMemory({ leaves: [{ ...leave, employeeId, startDate: bulkInput.startDate, endDate: bulkInput.endDate }] });
    const result = await handlers.bulkAssignShift(memory.mutationCtx, bulkInput);
    expect(result.results[0]).toMatchObject({ status: "skipped_leave", previewStatus: "on_leave" });
    expect((await handlers.bulkAssignShift(memory.mutationCtx, { ...bulkInput, calendarConfirmed: true })).insertedCount).toBe(1);
    const holidayMemory = seedMemory({ holidays: [{ ...holiday, date: bulkInput.startDate, projectId }] });
    expect((await handlers.bulkAssignShift(holidayMemory.mutationCtx, bulkInput)).results[0]).toMatchObject({ status: "failed", previewStatus: "holiday" });
    const denied = seedMemory({ employees: [{ ...employeeRow, projectId: "other-project" }] });
    expect((await handlers.previewBulkAssign(denied.queryCtx, bulkInput)).results[0]).toMatchObject({ status: "skipped", employeeName: "", reason: "Erişim yok" });
  });
  it("100 kişi sınırı, yinelenen kişi ve tarama bütçesi yazmadan reddedilir", async () => {
    const memory = seedMemory();
    await expect(handlers.previewBulkAssign(memory.queryCtx, { ...bulkInput, employeeIds: Array.from({ length: 101 }, (_, i) => `employee-${i}` as Id<"employees">) })).rejects.toThrow("1–100");
    await expect(handlers.bulkAssignShift(memory.mutationCtx, { ...bulkInput, employeeIds: [employeeId, employeeId] })).rejects.toThrow("birden fazla");
    const crowded = seedMemory({ leaves: Array.from({ length: 5001 }, (_, i) => ({ ...leave, _id: `leave-${i}`, employeeId })) });
    await expect(handlers.bulkAssignShift(crowded.mutationCtx, bulkInput)).rejects.toThrow("5000");
    expect(crowded.writes()).toBe(0);
  });
  it("aralıkta yalnız gerçek gece devamını döner; eski çağrı tüm serileri döner", async () => {
    const memory = seedMemory({ shifts: [{ ...shiftRow, ...night }, { ...shiftRow, _id: "day" }], shiftAssignments: [assignmentRow, { ...assignmentRow, _id: "day-assignment", shiftId: "day" }] });
    const rows = await handlers.listAssignments(memory.queryCtx, { projectId, rangeStart: "2026-10-20", rangeEnd: "2026-10-20", employeeIds: [employeeId] });
    expect(rows.map(row => row._id)).toEqual(["assignment"]);
    expect(memory.reads.some(read => read.index === "by_employee_end")).toBe(true);
    expect(memory.reads.every(read => read.limit !== null)).toBe(true);
    expect((await handlers.listAssignments(memory.queryCtx, { projectId })).length).toBe(2);
  });
  it("proje aralığı indeksi kullanılır; eksik aralık ve yetkisiz proje reddedilir", async () => {
    const memory = seedMemory({ shiftAssignments: [assignmentRow] });
    expect(await handlers.listAssignments(memory.queryCtx, { projectId, rangeStart: bulkInput.startDate, rangeEnd: bulkInput.endDate })).toHaveLength(1);
    expect(memory.reads.some(read => read.index === "by_project_end")).toBe(true);
    await expect(handlers.listAssignments(memory.queryCtx, { rangeStart: bulkInput.startDate })).rejects.toThrow("birlikte");
    await expect(handlers.listAssignments(memory.queryCtx, { projectId: "denied" as Id<"projects"> })).rejects.toThrow("erişim");
    const crowded = seedMemory({ shiftAssignments: Array.from({ length: 5001 }, (_, i) => ({ ...assignmentRow, _id: `assignment-${i}` })) });
    await expect(handlers.listAssignments(crowded.queryCtx, { projectId, rangeStart: bulkInput.startDate, rangeEnd: bulkInput.endDate })).rejects.toThrow("5000");
  });
  it("silme etkisi bütün serileri ve benzersiz kişiyi tam veya dürüst alt sınır sayar", async () => {
    const memory = seedMemory({ shiftAssignments: [assignmentRow, { ...assignmentRow, _id: "two" }, { ...assignmentRow, _id: "three", employeeId: "other" }] });
    expect(await handlers.assignmentDeleteImpact(memory.queryCtx, { shiftId })).toEqual({ assignmentCount: 3, employeeCount: 2, truncated: false, countLabel: "Toplam", skippedAssignments: 0 });
    const many = seedMemory({ shiftAssignments: Array.from({ length: 5002 }, (_, i) => ({ ...assignmentRow, _id: `assignment-${i}` })) });
    expect(await handlers.assignmentDeleteImpact(many.queryCtx, { shiftId })).toEqual({ assignmentCount: 5001, employeeCount: 1, truncated: true, countLabel: "En az", skippedAssignments: 0 });
    await expect(handlers.remove(many.mutationCtx, { shiftId })).rejects.toThrow("5000");
    expect(many.writes()).toBe(0);
    const corrupt = seedMemory({ shiftAssignments: [{ ...assignmentRow, projectId: "foreign" }] });
    await expect(handlers.assignmentDeleteImpact(corrupt.queryCtx, { shiftId })).rejects.toThrow("proje bilgisi");
  });
  it("tanım kullanımı TR bugün/gece devamı/desen/gelecek üzerinden sayılır", async () => {
    vi.useFakeTimers();
    try {
      // UTC 19th, İstanbul 20th.
      vi.setSystemTime(new Date("2026-10-19T22:00:00Z"));
      const memory = seedMemory({ shifts: [{ ...shiftRow, ...night }], shiftAssignments: [assignmentRow,
        { ...assignmentRow, _id: "past", startDate: "2026-10-18", endDate: "2026-10-18" },
        { ...assignmentRow, _id: "future", startDate: "2026-11-01", endDate: "2026-11-30", weekPattern: ["MON"] },
        { ...assignmentRow, _id: "no-day", startDate: "2026-11-01", endDate: "2026-11-01", weekPattern: ["MON"] }] });
      expect(await handlers.definitionUsage(memory.queryCtx, { shiftId })).toMatchObject({ assignmentCount: 2, employeeCount: 1, scannedAssignmentCount: 4, truncated: false, asOfDate: "2026-10-20", affectsHistoricalAssignments: true });
    } finally { vi.useRealTimers(); }
  });
});


describe("api-fix eski istemci ve eski kayıt uyumu", () => {
  it("yapılandırılmış kodda eski OVERLAP:n mesajını korur; detailed kişi sonucunu, onay atamayı döner", async () => {
    const memory = seedMemory({ shiftAssignments: [assignmentRow] });
    await expect(handlers.bulkAssignShift(memory.mutationCtx, bulkInput)).rejects.toMatchObject({ data: { code: "SHIFT_OVERLAP", message: "OVERLAP:1", overlapCount: 1 } });
    expect(memory.writes()).toBe(0);
    expect(await handlers.bulkAssignShift(memory.mutationCtx, { ...bulkInput, resultMode: "detailed" })).toMatchObject({
      insertedCount: 0, overlapCount: 1, results: [{ status: "skipped_conflict" }],
    });
    expect(memory.writes()).toBe(0);
    expect(await handlers.bulkAssignShift(memory.mutationCtx, { ...bulkInput, forceConfirm: true })).toMatchObject({ insertedCount: 1 });
  });
  it("projesiz eski ataması olan kişiyi atlar, diğer kişiye atar", async () => {
    const otherId = "other" as Id<"employees">;
    const memory = seedMemory({ employees: [employeeRow, { ...employeeRow, _id: otherId }],
      shiftAssignments: [{ ...assignmentRow, projectId: undefined }] });
    expect(await handlers.previewBulkAssign(memory.queryCtx, { ...bulkInput, employeeIds: [employeeId, otherId] })).toMatchObject({
      results: [{ status: "skipped", reason: "Eski kayıt proje bilgisi içermiyor" }, { status: "will_assign" }],
    });
    expect(await handlers.bulkAssignShift(memory.mutationCtx, { ...bulkInput, employeeIds: [employeeId, otherId], resultMode: "detailed" })).toMatchObject({
      insertedCount: 1, skipped: [{ employeeId, reason: "Eski kayıt proje bilgisi içermiyor" }],
      results: [{ status: "failed", previewStatus: "skipped" }, { status: "assigned" }],
    });
  });
  it("projesiz kaydı silme etkisi/kullanımına katmaz, silmeden bırakır ve dürüst sayar", async () => {
    const memory = seedMemory({ shiftAssignments: [assignmentRow, { ...assignmentRow, _id: "legacy", projectId: undefined }] });
    expect(await handlers.assignmentDeleteImpact(memory.queryCtx, { shiftId })).toMatchObject({ assignmentCount: 1, employeeCount: 1, skippedAssignments: 1 });
    expect(await handlers.definitionUsage(memory.queryCtx, { shiftId })).toMatchObject({ skippedAssignments: 1, scannedAssignmentCount: 2 });
    expect(await handlers.remove(memory.mutationCtx, { shiftId })).toEqual({ removedAssignments: 1, skippedAssignments: 1 });
    expect(memory.tables.get("shiftAssignments")).toEqual([{ ...assignmentRow, _id: "legacy", projectId: undefined }]);
  });
});


describe("09-O6 toplu tanım sayaçları", () => {
  it("tüm tanımların sayacını bir çağrıda döner, kişileri tekilleştirir ve eski kaydı ayrı tutar", async () => {
    const memory = seedMemory({ shifts: [shiftRow, { ...shiftRow, _id: "night", ...night }], shiftAssignments: [assignmentRow, { ...assignmentRow, _id: "a2" }, { ...assignmentRow, _id: "legacy", projectId: undefined }, { ...assignmentRow, _id: "a3", shiftId: "night" }] });
    const result = await handlers.definitionImpacts(memory.queryCtx, { projectId });
    expect(result).toEqual([
      { shiftId, assignmentCount: 2, employeeCount: 1, skippedAssignments: 1, truncated: false, countLabel: "Toplam", hasAssignments: true },
      { shiftId: "night", assignmentCount: 1, employeeCount: 1, skippedAssignments: 0, truncated: false, countLabel: "Toplam", hasAssignments: true },
    ]);
    expect(memory.reads.filter(read => read.table === "shiftAssignments")).toHaveLength(2);
    expect(memory.reads.every(read => read.limit !== null)).toBe(true);
  });
  it("5000 satır bütçesinden sonra toplamı bilinmeyen tutar; boş tanımın silme etkisini ayrıca hesaplar", async () => {
    const memory = seedMemory({ shifts: [shiftRow, { ...shiftRow, _id: "night" }], shiftAssignments: Array.from({ length: 5001 }, (_, i) => ({ ...assignmentRow, _id: `a${i}` })) });
    const result = await handlers.definitionImpacts(memory.queryCtx, { projectId });
    expect(result[0]).toMatchObject({ assignmentCount: 5000, truncated: true, countLabel: "En az" });
    expect(result[1]).toMatchObject({ assignmentCount: null, employeeCount: null, countLabel: "Hesaplanamadı", hasAssignments: false });
    expect(memory.reads.filter(read => read.table === "shiftAssignments")).toHaveLength(2);
    expect(memory.reads.filter(read => read.table === "shiftAssignments")[1]?.limit).toBe(1);
    expect(await handlers.assignmentDeleteImpact(memory.queryCtx, { shiftId: "night" as Id<"shifts"> })).toMatchObject({ assignmentCount: 0, truncated: false });
    expect(memory.reads.find(read => read.table === "shiftAssignments")?.limit).toBe(5001);
  });
  it("bütçesi biten ama ataması olan tanımda index üzerinden varlık bilgisini korur", async () => {
    const memory = seedMemory({ shifts: [shiftRow, { ...shiftRow, _id: "night" }], shiftAssignments: [
      ...Array.from({ length: 5000 }, (_, i) => ({ ...assignmentRow, _id: `a${i}` })),
      { ...assignmentRow, _id: "night-assignment", shiftId: "night" },
    ] });
    const result = await handlers.definitionImpacts(memory.queryCtx, { projectId });
    expect(result[1]).toMatchObject({ assignmentCount: null, hasAssignments: true, countLabel: "Hesaplanamadı" });
    expect(await handlers.assignmentDeleteImpact(memory.queryCtx, { shiftId: "night" as Id<"shifts"> })).toMatchObject({ assignmentCount: 1, truncated: false });
  });
  it("başka projeye erişimi reddeder, bozuk proje bağlantısını sayım dışında tutar", async () => {
    const memory = seedMemory({ shiftAssignments: [{ ...assignmentRow, projectId: "other" }] });
    await expect(handlers.definitionImpacts(memory.queryCtx, { projectId: "other" as Id<"projects"> })).rejects.toThrow("erişim");
    expect(await handlers.definitionImpacts(memory.queryCtx, { projectId })).toMatchObject([{ assignmentCount: 0, skippedAssignments: 1, hasAssignments: false }]);
  });
});


it("09-O4: gece çakışmasının gerekçesi de ortak ertesi gün etiketini kullanır", () => {
  const result = evaluateShiftAssignment({ ...base, shift: night, existing: [existing({ shift: night })] });
  expect(result.status).toBe("conflict");
  expect(result.reason).toContain("22:00–06:00 (+1 gün)");
});
