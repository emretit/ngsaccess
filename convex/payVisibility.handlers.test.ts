import { afterEach, describe, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import type { api } from "./_generated/api";
import * as auth from "./lib/auth";
import { listPage as visitorsListPage } from "./visitors";
import { list as employeesList, getById } from "./employees";
import { getMonthlyPayrollSheet, getPdksTableData } from "./cardReadings";
import { getDepartmentCostReport, getOvertimeSummaryReport } from "./reports";

// Real handlers, loaders and calculators; bypass only the authenticated wrappers.
vi.mock("./lib/customFunctions", () => {
  const passThrough = (config: unknown) => config;
  return {
    authedQuery: passThrough, authedMutation: passThrough, optionalAuthQuery: passThrough, superAdminQuery: passThrough,
    superAdminMutation: passThrough, authedAction: passThrough,
    employeeAuthedQuery: passThrough, employeeAuthedMutation: passThrough,
  };
});
afterEach(() => vi.restoreAllMocks());

const projectId = "project" as Id<"projects">;
const otherProjectId = "other-project" as Id<"projects">;
const roles = ["project_user", "project_admin", "super_admin"] as const;
const period = { projectId, year: 2026, month: 6 };
const employees: Doc<"employees">[] = [
  { _id: "hourly", firstName: "Ada", hourlyRate: 100, monthlySalary: 90000, departmentId: "dept-a" },
  { _id: "salary", firstName: "Zeynep", monthlySalary: 45000, departmentId: "dept-z" },
  { _id: "zero", firstName: "Zero", hourlyRate: 0, monthlySalary: 0, departmentId: "dept-zero" },
  { _id: "missing", firstName: "Missing", departmentId: "dept-missing" },
  { _id: "visitor", firstName: "Visitor", isVisitor: true, hourlyRate: 300, monthlySalary: 67500 },
].map((fields) => ({ ...fields, _creationTime: 0, projectId, lastName: "Test", cardNumber: fields._id, isActive: true })) as Doc<"employees">[];
const readings: Doc<"cardReadings">[] = employees.filter(e => !e.isVisitor).flatMap(emp =>
  ["06:00", "19:00"].map((time, i) => ({
    _id: `${emp._id}-${i}` as Id<"cardReadings">, _creationTime: 0, projectId,
    employeeId: emp._id, cardNo: emp.cardNumber, accessTime: `2026-06-22T${time}:00Z`,
    accessStatus: "izin_verildi", hikCurrentVerifyMode: "card",
  })),
);
const departments = [
  { _id: "dept-a", name: "Arge" }, { _id: "dept-z", name: "Ziraat" },
  { _id: "dept-zero", name: "Sıfır" }, { _id: "dept-missing", name: "Belirsiz" },
].map(d => ({ ...d, projectId }));

function fixture(role: typeof roles[number], overrides: Doc<"employees">[] = employees) {
  const tables: Record<string, Record<string, unknown>[]> = {
    employees: overrides, cardReadings: readings, departments,
    projects: [{ _id: projectId, name: "Test Projesi" }],
    userProjects: [{ _id: "membership", userId: "user", projectId }],
    // Exercise nonzero payable overtime so masking assertions stay meaningful.
    overtimeRates: [{ projectId, overtimeBasis: "dailyShift" }],
  };
  const query = (table: string) => {
    let rows = tables[table] ?? [];
    const index = {
      eq: (field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return index; },
      gte: () => index, lte: () => index,
    };
    const chain = {
      withIndex: (_name: string, configure: (range: typeof index) => unknown) => { configure(index); return chain; },
      filter: () => chain, order: () => chain,
      take: async (limit: number) => rows.slice(0, limit), collect: async () => [...rows], first: async () => rows[0] ?? null, unique: async () => rows[0] ?? null,
    };
    return chain;
  };
  vi.spyOn(auth, "getProjectIdsForUser").mockResolvedValue([projectId]);
  return {
    user: { _id: "user", _creationTime: 0, role },
    db: { query, get: async (id: string) => Object.values(tables).flat().find(row => row._id === id) ?? null },
  } as unknown as QueryCtx;
}
async function invoke<T>(fn: unknown, ctx: QueryCtx, args: object): Promise<T> {
  return (fn as { handler: (ctx: QueryCtx, args: object) => Promise<T> }).handler(ctx, args);
}

describe.each(roles)("%s public pay responses", (role) => {
  const visible = role !== "project_user";
  it("employees.list masks both fields after document spread, including zero/missing pay", async () => {
    const rows = await invoke<FunctionReturnType<typeof api.employees.list>>(employeesList, fixture(role), { projectId });
    expect(rows).toHaveLength(4);
    rows.forEach((row, i) => {
      expect(row.hourlyRate).toBe(visible ? employees[i].hourlyRate : null);
      expect(row.monthlySalary).toBe(visible ? employees[i].monthlySalary : null);
    });
  });
  it("employees.getById masks both fields and preserves project/orphan access", async () => {
    const ctx = fixture(role);
    for (const emp of employees) {
      const row = await invoke<FunctionReturnType<typeof api.employees.getById>>(getById, ctx, { employeeId: emp._id });
      expect(row).toMatchObject({ _id: emp._id });
      expect(row?.hourlyRate).toBe(visible ? emp.hourlyRate : null);
      expect(row?.monthlySalary).toBe(visible ? emp.monthlySalary : null);
    }
    const emp = employees[0];
    const foreign = { ...emp, projectId: otherProjectId };
    expect(await invoke(getById, fixture(role, [foreign]), { employeeId: emp._id })).toBeNull();
    const orphan = { ...emp, projectId: undefined };
    const result = await invoke(getById, fixture(role, [orphan]), { employeeId: emp._id });
    expect(result).toEqual(role === "super_admin" ? orphan : null);
  });
  it("visitors.listPage omits legacy pay from visitor rows", async () => {
    const visitor = employees.find(row => row.isVisitor);
    if (!visitor) throw new Error("Missing visitor fixture");
    const base = fixture(role);
    const query = (table: string) => {
      const chain = { withIndex: () => chain, order: () => chain, first: async () => null,
        async *[Symbol.asyncIterator]() { if (table === "employees") yield visitor; },
      };
      return chain;
    };
    const ctx = { ...base, db: { ...base.db, query } } as unknown as QueryCtx;
    const result = await invoke<FunctionReturnType<typeof api.visitors.listPage>>(visitorsListPage, ctx, { projectId, paginationOpts: { numItems: 25, cursor: null } });
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).not.toHaveProperty("hourlyRate");
    expect(result.page[0]).not.toHaveProperty("monthlySalary");
  });
  it("PDKS table masks rates and calculated pay in single and matrix views", async () => {
    for (const viewMode of ["single", "matrix"]) {
      const rows = await invoke<FunctionReturnType<typeof api.cardReadings.getPdksTableData>>(getPdksTableData, fixture(role), {
        projectId, startDate: "2026-06-22", endDate: viewMode === "single" ? "2026-06-22" : "2026-06-23", viewMode,
      });
      expect(rows.length).toBeGreaterThan(0);
      const hourly = rows.find(row => row.employeeId === "hourly");
      const salary = rows.find(row => row.employeeId === "salary");
      expect(hourly?.hourlyRate).toBe(visible ? 100 : null);
      expect(salary?.hourlyRate).toBe(visible ? 200 : null);
      rows.forEach(row => {
        if (!visible) expect(row).toMatchObject({ hourlyRate: null, overtimePayTRY: null });
      });
      if (visible) expect(hourly?.overtimePayTRY).toBeGreaterThan(0);
    }
  });
  it("monthly payroll masks every cell, row rate and total; manager salary fallback remains", async () => {
    const result = await invoke<FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>>(getMonthlyPayrollSheet, fixture(role), period);
    expect(result.rows).toHaveLength(5);
    result.rows.forEach(row => {
      const hasPay = row.employeeId === "hourly" || row.employeeId === "salary" || row.employeeId === "visitor";
      if (!visible || !hasPay) {
        expect(row.hourlyRate).toBeNull();
        expect(row.totals.overtimePayTRY).toBeNull();
        row.cells.forEach(cell => expect(cell.overtimePayTRY).toBeNull());
      }
    });
    const hourly = result.rows.find(row => row.employeeId === "hourly");
    const salary = result.rows.find(row => row.employeeId === "salary");
    expect(hourly?.hourlyRate).toBe(visible ? 100 : null);
    expect(salary?.hourlyRate).toBe(visible ? 200 : null);
    expect(hourly?.cells).toHaveLength(30);
    if (visible) {
      expect(hourly?.cells.find(c => c.date === "2026-06-22")?.overtimePayTRY).toBe(562.5);
      expect(hourly?.totals.overtimePayTRY).toBe(562.5);
    }
  });
  it("overtime summary masks every pay and total while preserving manager math", async () => {
    const result = await invoke<FunctionReturnType<typeof api.reports.getOvertimeSummaryReport>>(getOvertimeSummaryReport, fixture(role), period);
    expect(result.rows).toHaveLength(4);
    expect(result.totalOvertimePayTRY).toBe(visible ? 2250 : null);
    const hourly = result.rows.find(row => row.name === "Ada Test");
    expect(hourly?.overtimePayTRY).toBe(visible ? 750 : null);
    if (!visible) result.rows.forEach(row => expect(row.overtimePayTRY).toBeNull());
  });
  it("department report masks fallback/cost and orders users alphabetically, managers by cost", async () => {
    const result = await invoke<FunctionReturnType<typeof api.reports.getDepartmentCostReport>>(getDepartmentCostReport, fixture(role), { ...period, hourlyRate: 50 });
    expect(result.hourlyRate).toBe(visible ? 50 : null);
    expect(result.rows.map(row => row.department)).toEqual(visible
      ? ["Ziraat", "Arge", "Sıfır", "Belirsiz"] : ["Arge", "Belirsiz", "Sıfır", "Ziraat"]);
    expect(result.rows.map(row => row.cost)).toEqual(visible ? [1500, 750, 375, 375] : [null, null, null, null]);
  });
  it("list/report endpoints still reject a foreign selected project", async () => {
    for (const fn of [employeesList, visitorsListPage, getPdksTableData, getMonthlyPayrollSheet, getOvertimeSummaryReport, getDepartmentCostReport]) {
      await expect(invoke(fn, fixture(role), { ...period, projectId: otherProjectId })).rejects.toThrow("erişim yetkiniz yok");
    }
  });
});


it("project_user responses cannot reveal changing stored pay through costs or ordering", async () => {
  const changedPay = employees.map(emp => ({ ...emp, hourlyRate: 50000, monthlySalary: 999999 }));
  for (const [fn, args] of [
    [employeesList, { projectId }], [getById, { employeeId: employees[0]._id }],
    [getPdksTableData, { projectId, startDate: "2026-06-22", endDate: "2026-06-23" }],
    [getMonthlyPayrollSheet, period], [getOvertimeSummaryReport, period],
    [getDepartmentCostReport, { ...period, hourlyRate: 50 }],
  ] as const) {
    const original = await invoke(fn, fixture("project_user"), args);
    const changed = await invoke(fn, fixture("project_user", changedPay), args);
    expect(changed).toEqual(original);
  }
});
