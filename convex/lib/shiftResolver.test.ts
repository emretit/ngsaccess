// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "../schema";
import type { Doc, Id } from "../_generated/dataModel";
import { assignmentAppliesOnDate, buildBoundedShiftResolver, buildShiftResolver, createShiftResolver, departmentChain } from "./shiftResolver";
const modules = import.meta.glob("../**/*.ts");
const projectId = "project" as Id<"projects">;
const employee: Doc<"employees"> = { _id: "employee" as Id<"employees">, _creationTime: 0, projectId, departmentId: "child" as Id<"departments">, shiftId: "default" as Id<"shifts">, firstName: "Ada", lastName: "Test", email: "a@test.test", cardNumber: "1" };
const shift = (id: string): Doc<"shifts"> => ({ _id: id as Id<"shifts">, _creationTime: 0, projectId, name: id, startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
const shifts = ["default", "parentShift", "childShift", "personal", "last"].map(shift);
const department = (id: string, parentId?: string): Doc<"departments"> => ({ _id: id as Id<"departments">, _creationTime: 0, projectId, name: id, parentId: parentId as Id<"departments"> | undefined, createdAt: "", updatedAt: "" });
const departments = [department("child", "parent"), department("parent")];
const common = { _creationTime: 0, projectId, startDate: "2026-06-01", endDate: "2026-06-30", createdAt: "", updatedAt: "2026-06-01" };
const personal = (extra: Partial<Doc<"shiftAssignments">> = {}): Doc<"shiftAssignments"> => ({ ...common, _id: "personalAssignment" as Id<"shiftAssignments">, employeeId: employee._id, shiftId: "personal" as Id<"shifts">, ...extra });
const dept = (id: string, extra: Partial<Doc<"departmentShiftAssignments">> = {}): Doc<"departmentShiftAssignments"> => ({ ...common, _id: `${id}Assignment` as Id<"departmentShiftAssignments">, departmentId: id as Id<"departments">, shiftId: `${id}Shift` as Id<"shifts">, ...extra });
const date = "2026-06-01";

describe("shared DayPlan resolution", () => {
  it("requires a dated assignment even with the legacy shiftId", () => {
    const resolver = createShiftResolver([employee], shifts, [[personal({ startDate: "2026-06-15" })]]);
    expect(resolver.resolvePlan(employee._id, "2026-06-14").kind).toBe("none");
    expect(resolver.resolvePlan(employee._id, "2026-06-15").kind).toBe("shifts");
    expect(resolver.resolvePlan(employee._id, "2026-07-01").kind).toBe("none");
  });
  it("uses personal > nearest department > no plan and carries sources", () => {
    const resolve = (people: Doc<"shiftAssignments">[], depts: Doc<"departmentShiftAssignments">[], emp = employee) => createShiftResolver([emp], shifts, [people], departments, depts).resolvePlan(emp._id, date);
    expect(resolve([personal()], [dept("child"), dept("parent")])).toMatchObject({ kind: "shifts", source: "employee", calendar: "project", assignmentId: personal()._id, shifts: [shift("personal")] });
    expect(resolve([], [dept("parent"), dept("child")])).toMatchObject({ source: "department", departmentId: "child", departmentAssignmentId: "childAssignment", shifts: [shift("childShift")] });
    expect(resolve([], [dept("parent")])).toMatchObject({ source: "department", departmentId: "parent" });
    expect(resolve([], [])).toMatchObject({ kind: "none", source: "project" });
    expect(resolve([], [], { ...employee, shiftId: undefined })).toEqual({ kind: "none", source: "project" });
  });
  it("falls through unmatched weekdays to parent, then none", () => {
    const resolver = createShiftResolver([employee], shifts, [[personal({ weekPattern: ["TUE"] })]], departments, [dept("child", { weekPattern: ["TUE"] }), dept("parent", { weekPattern: ["MON"] })]);
    expect(resolver.resolvePlan(employee._id, date)).toMatchObject({ departmentId: "parent" });
    expect(resolver.resolvePlan(employee._id, "2026-06-03")).toMatchObject({ kind: "none", source: "project" });
  });
  it("preserves stable index order for equal updatedAt and selects latest updates", () => {
    const first = personal();
    const second = personal({ _id: "second" as Id<"shiftAssignments">, shiftId: "last" as Id<"shifts"> });
    expect(createShiftResolver([employee], shifts, [[first, second]]).resolve(employee._id, date)?._id).toBe("personal");
    expect(createShiftResolver([employee], shifts, [[second, first]]).resolve(employee._id, date)?._id).toBe("last");
    expect(createShiftResolver([employee], shifts, [[first, { ...second, updatedAt: "2026-07-01" }]]).resolve(employee._id, date)?._id).toBe("last");
    const a = dept("child"); const b = dept("child", { _id: "second" as Id<"departmentShiftAssignments">, shiftId: "last" as Id<"shifts"> });
    expect(createShiftResolver([employee], shifts, [[]], departments, [a, b]).resolve(employee._id, date)?._id).toBe("childShift");
  });
  it("matches rest without falling through and exposes last shift with memo identity", () => {
    const row = personal({ plan: { kind: "dayCycle", anchorDate: date, slots: [[], ["personal" as Id<"shifts">, "last" as Id<"shifts">]] } });
    const resolver = createShiftResolver([employee], shifts, [[row]], departments, [dept("child")]);
    expect(resolver.resolvePlan(employee._id, date)).toEqual({ kind: "rest", source: "employee", calendar: "plan", assignmentId: row._id });
    expect(resolver.resolve(employee._id, date)).toBeNull();
    expect(resolver.resolveLast(employee._id, date)).toBeNull();
    const next = "2026-06-02";
    expect(resolver.resolve(employee._id, next)?._id).toBe("personal");
    expect(resolver.resolveLast(employee._id, next)?._id).toBe("last");
    expect(resolver.resolvePlan(employee._id, next)).toBe(resolver.resolvePlan(employee._id, next));
    expect(resolver.resolvePlan(employee._id, next)).toMatchObject({ calendar: "plan" });
    const inheritedRest = createShiftResolver([employee], shifts, [[]], departments, [dept("child", { plan: row.plan }), dept("parent")]);
    expect(inheritedRest.resolvePlan(employee._id, date)).toMatchObject({ kind: "rest", source: "department", departmentId: "child" });
  });
  it("skips an entire row with deleted shifts, including a missing secondary", () => {
    const missing = "deleted" as Id<"shifts">;
    for (const row of [personal({ shiftId: missing }), personal({ plan: { kind: "weekly", shiftIds: ["personal" as Id<"shifts">, missing] } })]) {
      expect(createShiftResolver([employee], shifts, [[row]], departments, [dept("child", { shiftId: missing }), dept("parent")]).resolvePlan(employee._id, date)).toMatchObject({ departmentId: "parent" });
    }
  });
  it("bounds cycles and depth at 32, ignoring level and cross-project parents", () => {
    const cycle = [department("child", "parent"), department("parent", "child")];
    expect(departmentChain(employee.departmentId, projectId, new Map(cycle.map(item => [String(item._id), item])))).toEqual(["child", "parent"]);
    expect(createShiftResolver([employee], shifts, [[]], cycle, []).resolve(employee._id, date)?._id).toBeUndefined();
    const cross = [department("child", "foreign"), { ...department("foreign", "parent"), projectId: "other" as Id<"projects"> }, department("parent")];
    expect(createShiftResolver([employee], shifts, [[]], cross, [dept("parent")]).resolvePlan(employee._id, date)).toMatchObject({ kind: "none", source: "project" });
    const deep = Array.from({ length: 40 }, (_, i) => department(`d${i}`, `d${i + 1}`));
    expect(departmentChain("d0" as Id<"departments">, projectId, new Map(deep.map(item => [String(item._id), item])))).toHaveLength(32);
  });
  it("preserves dated legacy assignments for all legacy dates, patterns, deleted ids and stable ties", () => {
    const rows = [personal({ weekPattern: ["TUE"], updatedAt: "2026-06-03" }), personal({ shiftId: "deleted" as Id<"shifts">, updatedAt: "2026-06-04" }), personal({ shiftId: "last" as Id<"shifts">, weekPattern: ["MON", "FRI"], updatedAt: "2026-06-03" })];
    const resolver = createShiftResolver([employee], shifts, [rows]);
    const map = new Map(shifts.map(item => [String(item._id), item]));
    for (let i = 0; i < 45; i++) {
      const day = new Date(Date.parse("2026-05-25") + i * 86_400_000).toISOString().slice(0, 10);
      const old = rows.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter(row => assignmentAppliesOnDate(row, day)).map(row => map.get(row.shiftId)).find(item => item !== undefined) ?? null;
      expect(resolver.resolve(employee._id, day)).toStrictEqual(old);
      expect(resolver.resolveLast(employee._id, day)).toStrictEqual(old);
    }
  });
});

describe("bounded resolver loading", () => {
  const { _creationTime: _time, ...seed } = common;
  async function fixture() {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const projectId = await ctx.db.insert("projects", { name: "Test" });
      const departmentId = await ctx.db.insert("departments", { projectId, name: "Dept", createdAt: "", updatedAt: "" });
      const primary = await ctx.db.insert("shifts", { projectId, name: "Morning", startTime: "08:00", endTime: "12:00", createdAt: "", updatedAt: "" });
      const secondary = await ctx.db.insert("shifts", { projectId, name: "Night", startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "" });
      const employeeId = await ctx.db.insert("employees", { projectId, departmentId, firstName: "Ada", lastName: "Test", email: "a@test.test", cardNumber: "1" });
      return { projectId, departmentId, primary, secondary, employeeId };
    });
    return { t, ...ids };
  }
  it("loads all plan ids via get, applies to newly joined employees and agrees with the unbounded builder", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("departmentShiftAssignments", { ...seed, projectId: f.projectId, departmentId: f.departmentId, shiftId: f.primary, plan: { kind: "weekly", shiftIds: [f.primary, f.secondary] } });
      const employee = await ctx.db.get(f.employeeId);
      if (!employee) throw new Error("fixture");
      const spy = vi.spyOn(ctx.db, "query");
      const resolver = await buildBoundedShiftResolver(ctx, [employee], { start: date, end: date });
      expect(spy.mock.calls.some(([table]) => table === "shifts")).toBe(false);
      expect(resolver.shifts.has(f.secondary)).toBe(true);
      expect(resolver.resolveLast(f.employeeId, date)?._id).toBe(f.secondary);
      spy.mockRestore();
      expect(resolver.resolvePlan(f.employeeId, date)).toStrictEqual((await buildShiftResolver(ctx, [employee])).resolvePlan(f.employeeId, date));
      const joinedId = await ctx.db.insert("employees", { projectId: f.projectId, departmentId: f.departmentId, firstName: "New", lastName: "Person", email: "b@test.test", cardNumber: "2" });
      const joined = await ctx.db.get(joinedId);
      if (!joined) throw new Error("fixture");
      expect((await buildBoundedShiftResolver(ctx, [joined])).resolvePlan(joinedId, date)).toMatchObject({ source: "department" });
    });
  });
  it.each(["departments", "departmentShiftAssignments", "shiftAssignments"] as const)("rejects %s limit+1 instead of a partial answer", async table => {
    const f = await fixture();
    await f.t.run(async ctx => {
      // Department tree bounds apply only when there is a department assignment.
      if (table === "departments") await ctx.db.insert("departmentShiftAssignments", { ...seed, projectId: f.projectId, departmentId: f.departmentId, shiftId: f.primary });
      const count = table === "shiftAssignments" ? 1001 : table === "departments" ? 2000 : 2001;
      for (let i = 0; i < count; i++) {
        if (table === "departments") await ctx.db.insert(table, { projectId: f.projectId, name: String(i), createdAt: "", updatedAt: "" });
        else if (table === "shiftAssignments") await ctx.db.insert(table, { ...seed, projectId: f.projectId, employeeId: f.employeeId, shiftId: f.primary });
        else await ctx.db.insert(table, { ...seed, projectId: f.projectId, departmentId: f.departmentId, shiftId: f.primary });
      }
      const emp = await ctx.db.get(f.employeeId);
      if (!emp) throw new Error("fixture");
      await expect(buildBoundedShiftResolver(ctx, [emp])).rejects.toThrow("sınırı aşıldı");
    });
  });
});

it("bounded reports skip the legacy shiftId get and preserve creation-order ties with an end-date index", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Scoped" });
    const legacyId = await ctx.db.insert("shifts", { name: "Legacy", startTime: "22:00", endTime: "06:00", createdAt: "", updatedAt: "" });
    const firstId = await ctx.db.insert("shifts", { projectId, name: "First", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const secondId = await ctx.db.insert("shifts", { projectId, name: "Second", startTime: "09:00", endTime: "18:00", createdAt: "", updatedAt: "" });
    const id = await ctx.db.insert("employees", { projectId, shiftId: legacyId, firstName: "Test", lastName: "Tie", email: "tie@test", cardNumber: "1" });
    const employee = await ctx.db.get(id);
    if (!employee) throw new Error("Missing employee");
    const gets: unknown[] = [];
    const db = new Proxy(ctx.db, { get(target, key) {
      if (key !== "get") return Reflect.get(target, key);
      return (...args: unknown[]) => { gets.push(args[0]); return Reflect.apply(target.get, target, args); };
    } });
    const range = { start: "2026-06-15", end: "2026-06-16" };
    expect((await buildBoundedShiftResolver({ ...ctx, db }, [employee], range)).resolvePlan(id, range.start).kind).toBe("none");
    expect(gets).toEqual([]);
    const base = { employeeId: id, projectId, startDate: "2026-06-01", createdAt: "", updatedAt: "" };
    await ctx.db.insert("shiftAssignments", { ...base, shiftId: firstId, endDate: "2026-06-30" });
    await ctx.db.insert("shiftAssignments", { ...base, shiftId: secondId, endDate: "2026-06-20" });
    const resolver = await buildBoundedShiftResolver({ ...ctx, db }, [employee], range);
    expect(resolver.resolve(id, range.start)?._id).toBe(firstId);
    expect(gets).not.toContain(legacyId);
    expect(gets).toHaveLength(2);
  });
});

it("bounded reports load long and open-ended assignments and keep department creation-order ties", async () => {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const projectId = await ctx.db.insert("projects", { name: "Long" });
    const departmentId = await ctx.db.insert("departments", { projectId, name: "Ops", createdAt: "", updatedAt: "" });
    const longId = await ctx.db.insert("shifts", { projectId, name: "Long", startTime: "08:00", endTime: "17:00", createdAt: "", updatedAt: "" });
    const firstId = await ctx.db.insert("shifts", { projectId, name: "First", startTime: "07:00", endTime: "16:00", createdAt: "", updatedAt: "" });
    const secondId = await ctx.db.insert("shifts", { projectId, name: "Second", startTime: "09:00", endTime: "18:00", createdAt: "", updatedAt: "" });
    const personalId = await ctx.db.insert("employees", { projectId, firstName: "Uzun", lastName: "Atama", email: "long@test", cardNumber: "1" });
    const memberId = await ctx.db.insert("employees", { projectId, departmentId, firstName: "Departman", lastName: "Bağ", email: "dept@test", cardNumber: "2" });
    const base = { projectId, createdAt: "", updatedAt: "2026-01-01T00:00:00.000Z" };
    await ctx.db.insert("shiftAssignments", { ...base, employeeId: personalId, shiftId: longId, startDate: "2024-01-01", endDate: "2099-12-31" });
    // Created first but ends later: by_project_end would read it second.
    await ctx.db.insert("departmentShiftAssignments", { ...base, departmentId, shiftId: firstId, startDate: "2024-01-01", endDate: "2026-06-30" });
    await ctx.db.insert("departmentShiftAssignments", { ...base, departmentId, shiftId: secondId, startDate: "2024-01-01", endDate: "2026-06-20" });
    const employees = (await Promise.all([personalId, memberId].map(id => ctx.db.get(id)))).filter((e): e is NonNullable<typeof e> => e !== null);
    const range = { start: "2026-06-15", end: "2026-06-16" };
    const bounded = await buildBoundedShiftResolver(ctx, employees, range);
    const unbounded = await buildShiftResolver(ctx, employees);
    expect(bounded.resolve(personalId, range.start)?._id).toBe(longId);
    expect(bounded.resolve(memberId, range.start)?._id).toBe(unbounded.resolve(memberId, range.start)?._id);
    expect(bounded.resolve(memberId, range.start)?._id).toBe(firstId);
  });
});
