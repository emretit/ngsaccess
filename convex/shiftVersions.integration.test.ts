// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { DEFAULT_FLEXIBLE } from "./lib/pdksFlexible";

const past = "2026-06-22";
const today = "2026-06-24";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T16:00:00Z`)); });
afterEach(() => vi.useRealTimers());

async function fixture(patch: Partial<Doc<"shifts">> = {}) {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Sürüm" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const shiftId = await ctx.db.insert("shifts", { projectId, name: "Gündüz", startTime: "09:00", endTime: "17:00", lateToleranceMinutes: 0, createdAt: "", updatedAt: "", ...patch });
    const employeeId = await ctx.db.insert("employees", { projectId, firstName: "Ada", lastName: "Test", email: "version@example.test", cardNumber: "1", isActive: true });
    await ctx.db.insert("shiftAssignments", { projectId, employeeId, shiftId, startDate: "2026-01-01", endDate: "2026-12-31", createdAt: "", updatedAt: "" });
    return { projectId, employeeId, shiftId, userId, sessionId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const add = (day: string, time: string, direction: "entry" | "exit") => t.run(ctx => ctx.db.insert("cardReadings", {
    projectId: ids.projectId, employeeId: ids.employeeId, cardNo: "1", accessTime: new Date(`${day}T${time}:00+03:00`).toISOString(), accessStatus: "izin_verildi", direction,
  }));
  const day = async (date: string) => {
    const detail = await caller.query(api.cardReadings.getEmployeeAttendanceDetail, { projectId: ids.projectId, employeeId: ids.employeeId, startDate: date, endDate: date });
    return detail?.days.find(item => item.date === date);
  };
  const versions = () => t.run(ctx => ctx.db.query("shiftVersions").collect());
  return { t, caller, add, day, versions, ...ids };
}

describe("geçerlilik tarihli vardiya sürümü", () => {
  it("saat değişikliği geçmiş günü eski kuralla, başlangıçtan sonrasını yeni kuralla hesaplar", async () => {
    const f = await fixture();
    await f.add(past, "09:30", "entry"); await f.add(past, "17:00", "exit");
    await f.add(today, "09:30", "entry");
    expect(await f.day(past)).toMatchObject({ isLate: true });
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, startTime: "10:00", endTime: "18:00" });
    expect(await f.t.run(ctx => ctx.db.get(f.shiftId))).toMatchObject({ startTime: "10:00", versionedUntil: "2026-06-23" });
    expect(await f.versions()).toMatchObject([{ validUntil: "2026-06-23", rules: { startTime: "09:00", endTime: "17:00", lateToleranceMinutes: 0 } }]);
    expect(await f.day(past)).toMatchObject({ isLate: true });
    expect(await f.day(today)).toMatchObject({ isLate: false });
    const table = await f.caller.query(api.cardReadings.getPdksTableData, { projectId: f.projectId, date: past });
    expect(table.find(row => row.id === f.employeeId)).toMatchObject({ isLate: true, status: "late" });
  });
  it("aynı başlangıçla ikinci düzenleme yeni sürüm açmaz; geriye, ileriye ve tür değişikliğine izin vermez", async () => {
    const f = await fixture();
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, startTime: "10:00", endTime: "18:00", effectiveFrom: today });
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, lateToleranceMinutes: 5, effectiveFrom: today });
    expect(await f.versions()).toHaveLength(1);
    expect((await f.versions())[0].rules).toMatchObject({ startTime: "09:00", lateToleranceMinutes: 0 });
    await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, lateToleranceMinutes: 10, effectiveFrom: "2026-06-23" })).rejects.toThrow("zaten değişti");
    await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, lateToleranceMinutes: 10, effectiveFrom: "2026-06-25" })).rejects.toThrow("bugün ya da geçmiş");
    await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE })).rejects.toThrow("yeni tanım");
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, name: "Yeni ad", isActive: false });
    expect(await f.versions()).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("auditLog").collect())).toHaveLength(2);
  });
  it("geçmişe dönük başlangıç düzeltmesi o günden itibaren uygulanır; tanım silinince sürümler de silinir", async () => {
    const f = await fixture();
    await f.add(past, "09:30", "entry"); await f.add(past, "17:00", "exit");
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, lateToleranceMinutes: 45, effectiveFrom: past });
    expect(await f.versions()).toMatchObject([{ validUntil: "2026-06-21" }]);
    expect(await f.day(past)).toMatchObject({ isLate: false });
    await f.t.run(async ctx => { for (const row of await ctx.db.query("shiftAssignments").collect()) await ctx.db.delete(row._id); });
    await f.caller.mutation(api.shifts.remove, { shiftId: f.shiftId });
    expect(await f.versions()).toHaveLength(0);
  });
  it("esnek hedef değişikliği geçmiş günün hedefini korur", async () => {
    const f = await fixture({ scheduleType: "flexible", flexible: { ...DEFAULT_FLEXIBLE }, startTime: "05:00", endTime: "22:00", lateToleranceMinutes: undefined });
    await f.add(past, "08:00", "entry"); await f.add(past, "15:00", "exit");
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, flexible: { ...DEFAULT_FLEXIBLE, requiredNetMinutes: 360 } });
    expect(await f.day(past)).toMatchObject({ scheduleType: "flexible", requiredNetMinutes: 480, shortfallMinutes: 120 });
    expect(await f.versions()).toMatchObject([{ validUntil: "2026-06-23", rules: { scheduleType: "flexible", flexible: { requiredNetMinutes: 480 } } }]);
  });
  it("eski türsüz sabit tanım formun tam yüküyle yeniden adlandırılır, sürüm açılmaz", async () => {
    const f = await fixture();
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, name: "Yeni ad", scheduleType: "fixed", startTime: "09:00", endTime: "17:00", lateToleranceMinutes: 0, breakStart: null, breakEnd: null, effectiveFrom: today });
    expect(await f.t.run(ctx => ctx.db.get(f.shiftId))).toMatchObject({ name: "Yeni ad" });
    expect(await f.versions()).toHaveLength(0);
  });
  it("saat değişikliği bu tanımı kullanan çok vardiyalı planı bozacaksa reddedilir; biten plan engel değildir", async () => {
    const f = await fixture({ startTime: "09:00", endTime: "12:00" });
    const evening = await f.t.run(async ctx => {
      const id = await ctx.db.insert("shifts", { projectId: f.projectId, name: "Öğleden sonra", startTime: "12:30", endTime: "17:00", createdAt: "", updatedAt: "" });
      const assignmentId = await ctx.db.insert("shiftAssignments", { projectId: f.projectId, employeeId: f.employeeId, shiftId: f.shiftId, startDate: "2026-06-01", endDate: "2026-12-31",
        plan: { kind: "weekly", shiftIds: [f.shiftId, id] }, createdAt: "", updatedAt: "" });
      for (const shiftId of [f.shiftId, id]) await ctx.db.insert("shiftPlanRefs", { projectId: f.projectId, shiftId, assignmentId });
      return { id, assignmentId };
    });
    await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, endTime: "14:00" })).rejects.toThrow("planını bozuyor");
    expect(await f.versions()).toHaveLength(0);
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, endTime: "12:00" });
    await f.t.run(ctx => ctx.db.patch(evening.assignmentId, { endDate: "2026-06-20" }));
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, endTime: "14:00" });
    expect(await f.t.run(ctx => ctx.db.get(f.shiftId))).toMatchObject({ endTime: "14:00" });
  });
});
