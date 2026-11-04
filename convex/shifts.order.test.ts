// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { buildBoundedShiftResolver, buildShiftResolver } from "./lib/shiftResolver";
import type { ShiftPlan } from "./lib/shiftPlan";
import { ruleSnapshot } from "./lib/shiftVersions";
import { computePdksPlannedDay, shiftForInstant, splitReadingsByShift } from "./lib/pdksMultiShift";
import { DEFAULT_OVERTIME_RATES, DEFAULT_WORK_SETTINGS } from "./lib/pdksHelpers";

const past = "2026-06-22";
const today = "2026-06-24";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T16:00:00Z`)); });
afterEach(() => vi.useRealTimers());

async function fixture(source: "employee" | "department", kind: ShiftPlan["kind"]) {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Plan sırası" });
    const userId = await ctx.db.insert("users", { role: "project_admin" });
    const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert("userProjects", { userId, projectId });
    const departmentId = await ctx.db.insert("departments", { projectId, name: "Bölüm", createdAt: "", updatedAt: "" });
    const employeeId = await ctx.db.insert("employees", { projectId, departmentId, firstName: "Ada", lastName: "Test", email: "order@example.test", cardNumber: "1", isActive: true });
    const a = await ctx.db.insert("shifts", { projectId, name: "A", startTime: "09:00", endTime: "12:00", createdAt: "", updatedAt: "" });
    const b = await ctx.db.insert("shifts", { projectId, name: "B", startTime: "14:00", endTime: "18:00", createdAt: "", updatedAt: "" });
    const plan: ShiftPlan = kind === "weekly" ? { kind, shiftIds: [a, b] }
      : { kind, anchorDate: past, slots: kind === "dayCycle" ? [[a, b], []] : [[a, b], [], [a, b], [], [], [], []] };
    const common = { projectId, shiftId: a, plan, startDate: "2026-06-01", endDate: "2026-06-30",
      weekPattern: kind === "weekly" ? ["MON", "WED"] : [], createdAt: "", updatedAt: "" };
    const owner = source === "employee"
      ? { assignmentId: await ctx.db.insert("shiftAssignments", { ...common, employeeId }) }
      : { departmentAssignmentId: await ctx.db.insert("departmentShiftAssignments", { ...common, departmentId }) };
    for (const shiftId of [a, b]) await ctx.db.insert("shiftPlanRefs", { projectId, shiftId, ...owner });
    return { projectId, employeeId, userId, sessionId, a, b };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const resolve = (date: string) => t.run(async ctx => {
    const employee = await ctx.db.get(ids.employeeId);
    if (!employee) throw new Error("Çalışan bulunamadı");
    const range = { start: date, end: date };
    const bounded = await buildBoundedShiftResolver(ctx, [employee], range);
    const unbounded = await buildShiftResolver(ctx, [employee], range);
    const plan = bounded.resolvePlan(employee._id, date);
    expect(unbounded.resolvePlan(employee._id, date)).toEqual(plan);
    expect(bounded.resolvePlan(employee._id, date)).toBe(plan);
    const first = bounded.resolve(employee._id, date);
    const last = bounded.resolveLast(employee._id, date);
    const timing = { kind: plan.kind, first: first?._id, last: last?._id,
      shifts: plan.kind === "none" ? [] : plan.shifts.map(shift => ({ _id: shift._id, ...ruleSnapshot(shift) })) };
    return { plan, first, last, timing };
  });
  const readings = (date: string, times: string[], directed: boolean): Doc<"cardReadings">[] => times.map((time, index) => ({
    _id: `${date}-${index}` as Id<"cardReadings">, _creationTime: 0, projectId: ids.projectId, employeeId: ids.employeeId,
    cardNo: "1", accessStatus: "izin_verildi", accessTime: new Date(`${date}T${time}:00+03:00`).toISOString(),
    direction: directed ? index % 2 === 0 ? "entry" : "exit" : undefined,
  }));
  return { ...ids, t, caller, resolve, readings };
}

describe.each(["employee", "department"] as const)("PDK-002: %s planında tarihli parça sırası", source => {
  it.each(["weekly", "dayCycle", "weekCycle"] as const)("%s saat değişince [B,A] çözülür; eski gün [A,B] kalır", async kind => {
    const f = await fixture(source, kind);
    const before = await f.resolve(past);
    const beforeRest = await f.resolve("2026-06-23");
    await f.caller.mutation(api.shifts.update, { shiftId: f.a, startTime: "19:00", endTime: "22:00", effectiveFrom: today });
    const current = await f.resolve(today);
    if (current.plan.kind !== "shifts") throw new Error("Çalışma günü bekleniyordu");
    for (const directed of [false, true]) {
      const readings = f.readings(today, ["14:00", "18:00", "19:00", "22:00"], directed);
      const buckets = splitReadingsByShift(today, readings, current.plan.shifts);
      expect(buckets.map(bucket => bucket.length)).toEqual([2, 2]);
      expect(current.plan.shifts.map(shift => shift._id)).toEqual([f.b, f.a]);
      expect(buckets).toEqual([readings.slice(0, 2), readings.slice(2)]);
      readings.forEach((reading, index) => expect(shiftForInstant(today, reading.accessTime, current.plan, reading.direction)?._id).toBe(index < 2 ? f.b : f.a));
      const day = computePdksPlannedDay({ date: today, readings, dayPlan: current.plan, shift: current.first,
        workSettings: DEFAULT_WORK_SETTINGS, overtimeRates: DEFAULT_OVERTIME_RATES });
      expect(day.attendanceDecision).toBe("present");
      expect(day.segments).toMatchObject([
        { shiftId: f.b, plannedStart: "14:00", plannedEnd: "18:00", firstISO: readings[0].accessTime, lastISO: readings[1].accessTime },
        { shiftId: f.a, plannedStart: "19:00", plannedEnd: "22:00", firstISO: readings[2].accessTime, lastISO: readings[3].accessTime },
      ]);
    }
    expect(current.first?._id).toBe(f.b);
    expect(current.last?._id).toBe(f.a);
    const old = await f.resolve(past);
    expect(old.timing).toEqual(before.timing);
    expect((await f.resolve("2026-06-23")).timing).toEqual(beforeRest.timing);
    if (old.plan.kind !== "shifts") throw new Error("Geçmiş çalışma günü bekleniyordu");
    expect(old.plan.shifts.map(shift => [shift._id, shift.startTime, shift.endTime])).toEqual([
      [f.a, "09:00", "12:00"], [f.b, "14:00", "18:00"],
    ]);
    const oldReadings = f.readings(past, ["09:00", "12:00", "14:00", "18:00"], true);
    expect(splitReadingsByShift(past, oldReadings, old.plan.shifts)).toEqual([oldReadings.slice(0, 2), oldReadings.slice(2)]);
    const rest = await f.resolve("2026-06-25");
    expect(rest.plan).toMatchObject({ kind: "rest", shifts: [{ _id: f.b, startTime: "14:00" }, { _id: f.a, startTime: "19:00" }] });
    expect(rest.first?._id).toBe(f.b);
    expect(rest.last?._id).toBe(f.a);
  });
});
