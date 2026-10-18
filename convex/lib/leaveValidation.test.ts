import { describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { approve, create, employeeOptions, list, listForRange, listPage, reject, summary, update } from "../leaves";
import { calendarDays, LEAVE_ERRORS, overlaps, validateLeaveRange } from "./leaveValidation";

// No convex-test package is installed. Keep the real authedQuery/adminMutation wrappers;
// replace identity/project lookup and database transport, as in liveReadings.test.ts.
vi.mock("./auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("./auth")>(),
  getCurrentUser: vi.fn(async (ctx: { user: Doc<"users"> }) => ctx.user),
  getProjectIdsForUser: vi.fn(async (ctx: { allowedProjectIds?: string[] }) => ctx.allowedProjectIds ?? ["project"]),
}));

const projectId = "project" as Id<"projects">;
const employeeId = "employee" as Id<"employees">;
const leaveId = "leave" as Id<"leaves">;
const departmentId = "department" as Id<"departments">;
const timestamp = "2026-10-01T00:00:00.000Z";
const input = { projectId, employeeId, leaveType: "annual" as const, startDate: "2026-10-01", endDate: "2026-10-03" };
const filters = { projectId, rangeStart: "2026-10-01", rangeEnd: "2026-10-31" };
const paginationOpts = { numItems: 25, cursor: null };
const savedLeave = (overrides: Partial<Doc<"leaves">> = {}): Doc<"leaves"> => ({
  ...input, _id: leaveId, _creationTime: 1, status: "approved", notes: "Eski not",
  createdAt: timestamp, updatedAt: timestamp, ...overrides,
});
type Row = Record<string, unknown>;
function fixture(leaves: Doc<"leaves">[] = []) {
  const user = { _id: "admin", role: "project_admin" };
  const tables: Record<string, Row[]> = {
    leaves,
    employees: [{ _id: employeeId, projectId, firstName: "Ada", lastName: "Test", departmentId, isActive: true }],
    departments: [{ _id: departmentId, projectId, name: "Üretim" }],
  };
  const indexes: { table: string; name: string; bounds: [string, string, unknown][] }[] = [];
  const query = (table: string) => {
    let selected = [...(tables[table] ?? [])];
    let sortField = "_creationTime";
    const bounds: [string, string, unknown][] = [];
    const index = {
      eq: (field: string, value: unknown) => {
        bounds.push(["eq", field, value]); selected = selected.filter(row => row[field] === value); return index;
      },
      lte: (field: string, value: string) => {
        bounds.push(["lte", field, value]); selected = selected.filter(row => typeof row[field] === "string" && row[field] <= value); return index;
      },
      gte: (field: string, value: string) => {
        bounds.push(["gte", field, value]); selected = selected.filter(row => typeof row[field] === "string" && row[field] >= value); return index;
      },
    };
    const chain = {
      withIndex: (name: string, apply: (q: typeof index) => unknown) => {
        indexes.push({ table, name, bounds });
        sortField = name.endsWith("_start") ? "startDate" : name.endsWith("_end") ? "endDate" : "_creationTime";
        apply(index); return chain;
      },
      order: (direction: string) => {
        selected.sort((a, b) => (String(a[sortField]).localeCompare(String(b[sortField]))
          || Number(a._creationTime ?? 0) - Number(b._creationTime ?? 0)
          || String(a._id).localeCompare(String(b._id))) * (direction === "desc" ? -1 : 1));
        return chain;
      },
      take: async (n: number) => selected.slice(0, n),
      collect: async () => selected,
      paginate: async (opts: { numItems: number; cursor: string | null; maximumRowsRead: number }) => {
        expect(opts.maximumRowsRead).toBeLessThanOrEqual(200);
        const offset = Number(opts.cursor ?? 0);
        const count = Math.min(opts.numItems, opts.maximumRowsRead);
        return { page: selected.slice(offset, offset + count), isDone: offset + count >= selected.length, continueCursor: String(offset + count) };
      },
    };
    return chain;
  };
  const get = vi.fn(async (id: string) => structuredClone(Object.values(tables).flat().find(row => row._id === id) ?? null));
  const patch = vi.fn(async (id: string, values: Row) => {
    const row = Object.values(tables).flat().find(value => value._id === id);
    if (!row) throw new Error("Missing fixture row");
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete row[key];
      else row[key] = value;
    }
  });
  const insert = vi.fn(async (table: string, row: Row) => {
    const id = `inserted-${tables[table]?.length ?? 0}`;
    tables[table] = [...(tables[table] ?? []), { ...row, _id: id, _creationTime: 10 }];
    return id;
  });
  return { ctx: { user, allowedProjectIds: [projectId] as string[], db: { query, get, patch, insert } }, tables, indexes, get, patch, insert };
}
async function invoke<T = unknown>(fn: unknown, ctx: unknown, args: object): Promise<T> {
  return (fn as { _handler: (ctx: MutationCtx | QueryCtx, args: object) => Promise<T> })._handler(ctx as MutationCtx, args);
}
function errorData(code: keyof typeof LEAVE_ERRORS) {
  return { data: { code, message: LEAVE_ERRORS[code] } };
}

describe("leave calendar validation", () => {
  it.each(["2026-02-30", "2026-02-29", "1900-02-29", "2026-13-01", "2026-04-31", "2026-2-01", "2026-01-01T00:00:00Z", "", "0000-01-01"])("rejects %s", date => {
    expect(() => validateLeaveRange(date, "2026-12-31")).toThrow(ConvexError);
    try { validateLeaveRange(date, "2026-12-31"); } catch (error) { expect(error).toMatchObject(errorData("LEAVE_INVALID_DATE")); }
  });
  it("counts leap years and shared days inclusively, independent of DST", () => {
    expect(calendarDays("2024-02-28", "2024-03-01")).toBe(3);
    expect(calendarDays("2000-02-29", "2000-02-29")).toBe(1);
    expect(calendarDays("2026-03-28", "2026-03-30")).toBe(3);
    expect(calendarDays("0099-12-31", "0100-01-01")).toBe(2);
    expect(calendarDays("9999-12-31", "9999-12-31")).toBe(1);
  });
  it("rejects reversed and >366-day saves but permits long query ranges", () => {
    expect(() => validateLeaveRange("2026-10-02", "2026-10-01")).toThrow(LEAVE_ERRORS.LEAVE_RANGE_REVERSED);
    expect(validateLeaveRange("2024-01-01", "2024-12-31")).toBe(366);
    expect(() => validateLeaveRange("2024-01-01", "2025-01-01")).toThrow(LEAVE_ERRORS.LEAVE_TOO_LONG);
    expect(calendarDays("2024-01-01", "2025-01-01")).toBe(367);
  });
  it("handles endpoint overlap and adjacent nonoverlapping ranges", () => {
    expect(overlaps("2026-10-01", "2026-10-03", "2026-10-03", "2026-10-05")).toBe(true);
    expect(overlaps("2026-10-01", "2026-10-03", "2026-10-04", "2026-10-05")).toBe(false);
  });
});

describe("leave mutations with real role wrappers", () => {
  it("creates approved and rejects duplicate resubmission without a second insert", async () => {
    const f = fixture();
    await invoke(create, f.ctx, input);
    expect(f.tables.leaves[0]).toMatchObject({ ...input, status: "approved", approvedBy: "admin" });
    await expect(invoke(create, f.ctx, input)).rejects.toMatchObject(errorData("LEAVE_OVERLAP"));
    expect(f.insert).toHaveBeenCalledTimes(1);
    expect(f.indexes).toContainEqual({ table: "leaves", name: "by_employee_start", bounds: [["eq", "employeeId", employeeId], ["lte", "startDate", input.endDate]] });
  });
  it("blocks partial overlaps across types with a usable conflict payload", async () => {
    const f = fixture([savedLeave()]);
    await expect(invoke(create, f.ctx, { ...input, leaveType: "sick", startDate: "2026-10-03", endDate: "2026-10-07" })).rejects.toMatchObject({
      data: { code: "LEAVE_OVERLAP", conflictLeaveId: leaveId, conflictStartDate: input.startDate, conflictEndDate: input.endDate, conflictLeaveType: "annual" },
    });
    expect(f.insert).not.toHaveBeenCalled();
  });
  it.each(["pending", "rejected"] as const)("does not reserve dates for legacy %s", async status => {
    const f = fixture([savedLeave({ status })]);
    await invoke(create, f.ctx, input);
    expect(f.insert).toHaveBeenCalledTimes(1);
    await expect(invoke(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp, notes: "x" })).rejects.toMatchObject(errorData("LEAVE_READ_ONLY"));
  });
  it("uses the same overlap rule for updates and excludes the record being edited", async () => {
    const f = fixture([savedLeave(), savedLeave({ _id: "other-leave" as Id<"leaves">, startDate: "2026-10-05", endDate: "2026-10-06" })]);
    await expect(invoke(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp, endDate: "2026-10-05" })).rejects.toMatchObject(errorData("LEAVE_OVERLAP"));
    await invoke(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp, leaveType: "sick" });
    expect(f.tables.leaves[0]).toMatchObject({ employeeId, projectId, status: "approved", leaveType: "sick", notes: "Eski not" });
  });
  it.each([
    { label: "long", overrides: { startDate: "2020-01-01" }, code: "LEAVE_TOO_LONG" },
    { label: "invalid", overrides: { startDate: "2026-02-30" }, code: "LEAVE_INVALID_DATE" },
    { label: "overlapping", overrides: {}, code: "LEAVE_OVERLAP" },
  ] as const)("allows notes-only edits to $label legacy dates but validates changed dates", async ({ overrides, code }) => {
    const legacy = savedLeave(overrides);
    const other = savedLeave({ _id: "other" as Id<"leaves"> });
    const f = fixture([legacy, other]);
    const result = await invoke<FunctionReturnType<typeof api.leaves.update>>(update, f.ctx, {
      leaveId, expectedUpdatedAt: timestamp, notes: "Yeni not",
    });
    expect(f.tables.leaves[0].notes).toBe("Yeni not");
    expect(f.indexes.some(index => index.name === "by_employee_start")).toBe(false);
    // Explicitly re-sending unchanged dates must also bypass legacy validation.
    const same = await invoke<FunctionReturnType<typeof api.leaves.update>>(update, f.ctx, {
      leaveId, expectedUpdatedAt: result.updatedAt, startDate: legacy.startDate, endDate: legacy.endDate, leaveType: "sick",
    });
    await expect(invoke(update, f.ctx, { leaveId, expectedUpdatedAt: same.updatedAt, endDate: "2026-10-04" }))
      .rejects.toMatchObject(errorData(code));
    expect(f.patch).toHaveBeenCalledTimes(2);
  });
  it("blocks approval of conflicting legacy pending leaves and excludes itself otherwise", async () => {
    const pending = savedLeave({ status: "pending" });
    const f = fixture([pending, savedLeave({ _id: "other" as Id<"leaves"> })]);
    await expect(invoke(approve, f.ctx, { leaveId })).rejects.toMatchObject(errorData("LEAVE_OVERLAP"));
    expect(f.patch).not.toHaveBeenCalled();
    f.tables.leaves.pop();
    await invoke(approve, f.ctx, { leaveId });
    expect(f.tables.leaves[0].status).toBe("approved");
  });
  it("clears null notes, preserves omitted notes and detects a stale writer even in the same millisecond", async () => {
    const now = Date.parse(timestamp);
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      const f = fixture([savedLeave()]);
      const first = await invoke<FunctionReturnType<typeof api.leaves.update>>(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp });
      expect(first.updatedAt).toBe("2026-10-01T00:00:00.001Z");
      expect(f.tables.leaves[0].notes).toBe("Eski not");
      await expect(invoke(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp, notes: "Stale" })).rejects.toMatchObject(errorData("LEAVE_STALE"));
      await invoke(update, f.ctx, { leaveId, expectedUpdatedAt: first.updatedAt, notes: null });
      expect(f.tables.leaves[0]).not.toHaveProperty("notes");
      expect(f.tables.leaves[0].updatedAt).toBe("2026-10-01T00:00:00.002Z");
    } finally { clock.mockRestore(); }
  });
  it("rejects member writes, inaccessible projects and employee/project mismatches", async () => {
    const f = fixture([savedLeave()]);
    f.ctx.user.role = "member";
    await expect(invoke(create, f.ctx, input)).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(invoke(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp })).rejects.toThrow("Bu işlem için yetkiniz yok");
    f.ctx.user.role = "project_admin";
    await expect(invoke(create, f.ctx, { ...input, projectId: "other" })).rejects.toMatchObject(errorData("LEAVE_PROJECT_MISMATCH"));
    f.tables.employees[0].projectId = "other";
    await expect(invoke(create, f.ctx, input)).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    await expect(invoke(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp })).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    expect(f.insert).not.toHaveBeenCalled(); expect(f.patch).not.toHaveBeenCalled();
  });
  it("rejects invalid ranges through create and update before writing", async () => {
    const f = fixture([savedLeave()]);
    await expect(invoke(create, f.ctx, { ...input, startDate: "2026-02-30" })).rejects.toMatchObject(errorData("LEAVE_INVALID_DATE"));
    await expect(invoke(update, f.ctx, { leaveId, expectedUpdatedAt: timestamp, endDate: "2026-09-30" })).rejects.toMatchObject(errorData("LEAVE_RANGE_REVERSED"));
    await expect(invoke(create, f.ctx, { ...input, endDate: "2028-01-01" })).rejects.toMatchObject(errorData("LEAVE_TOO_LONG"));
    expect(f.insert).not.toHaveBeenCalled(); expect(f.patch).not.toHaveBeenCalled();
  });
  it("fails closed when the overlap scan cannot prove safety", async () => {
    const f = fixture(Array.from({ length: 5001 }, (_, n) => savedLeave({ _id: `rejected-${n}` as Id<"leaves">, status: "rejected" })));
    await expect(invoke(create, f.ctx, input)).rejects.toMatchObject(errorData("LEAVE_SCAN_LIMIT"));
    expect(f.insert).not.toHaveBeenCalled();
  });
  it("preserves the legacy decision and list entry points", async () => {
    const f = fixture([savedLeave({ status: "pending" })]);
    await invoke(approve, f.ctx, { leaveId });
    expect(f.tables.leaves[0]).toMatchObject({ status: "approved", notes: "Eski not" });
    f.tables.leaves[0].status = "pending";
    await invoke(reject, f.ctx, { leaveId, notes: "Ret" });
    expect(await invoke(list, f.ctx, { projectId, employeeId, status: "rejected" })).toHaveLength(1);
  });
});

describe("bounded leave queries", () => {
  it("keeps crossing-month and >366-day legacy rows visible in list, summary and calendar", async () => {
    const long = savedLeave({ startDate: "2020-01-01", endDate: "2026-10-02" });
    const f = fixture([long, savedLeave({ _id: "crossing" as Id<"leaves">, startDate: "2026-09-30" })]);
    const page = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...filters, paginationOpts });
    expect(page.page.map(row => row._id)).toEqual(["crossing", leaveId]);
    expect(page.page[1].calendarDays).toBeGreaterThan(366);
    expect(await invoke(summary, f.ctx, filters)).toMatchObject({ recordCount: 2, employeeCount: 1, truncated: false });
    expect(await invoke(listForRange, f.ctx, { projectId, startDate: filters.rangeStart, endDate: filters.rangeEnd })).toEqual([long, f.tables.leaves[1]]);
    expect(f.indexes.some(index => index.name === "by_project_end")).toBe(true);
  });
  it("deduplicates employee and department loads and returns explicit fields", async () => {
    const f = fixture([savedLeave(), savedLeave({ _id: "second" as Id<"leaves"> })]);
    const page = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...filters, paginationOpts });
    expect(f.get.mock.calls.filter(([id]) => id === employeeId)).toHaveLength(1);
    expect(f.get.mock.calls.filter(([id]) => id === departmentId)).toHaveLength(1);
    expect(page.page[0]).toMatchObject({ employeeName: "Ada Test", departmentName: "Üretim", employeeMissing: false, calendarDays: 3 });
    expect(page.page[0]).not.toHaveProperty("_creationTime");
    expect(page.page[0]).not.toHaveProperty("approvedBy");
  });
  it("preserves missing-person and malformed legacy records without exposing a moved employee", async () => {
    const f = fixture([savedLeave({ startDate: "2026-02-30" })]);
    f.tables.employees[0].projectId = "other";
    const page = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...filters, paginationOpts });
    expect(page.page[0]).toMatchObject({ employeeName: "Personel bulunamadı", employeeMissing: true, calendarDays: null });
    expect(page.page[0].departmentName).toBeUndefined();
  });
  it("applies all filters, scopes projects and retains a cursor across empty candidate pages", async () => {
    const f = fixture([
      savedLeave({ _id: "first" as Id<"leaves">, startDate: "2026-10-05", endDate: "2026-10-05", leaveType: "sick" }),
      savedLeave(),
      savedLeave({ _id: "foreign" as Id<"leaves">, projectId: "other" as Id<"projects"> }),
    ]);
    const args = { ...filters, employeeId, leaveType: "annual", status: "approved", paginationOpts: { numItems: 1, cursor: null } };
    const first = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, args);
    expect(first).toMatchObject({ page: [], isDone: false, scannedCount: 1, filterScope: "candidatePage" });
    const next = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...args, paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect(next.page.map(row => row._id)).toEqual([leaveId]);
    expect(next.isDone).toBe(true);
    expect(await invoke(summary, f.ctx, args)).toMatchObject({ recordCount: 1, employeeCount: 1, truncated: false });
    for (const override of [{ employeeId: "missing" }, { status: "rejected" }]) {
      const filtered = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...args, ...override, paginationOpts });
      expect(filtered.page).toEqual([]);
    }
  });
  it("keeps tied-start pagination stable without duplicate rows", async () => {
    const f = fixture([savedLeave(), savedLeave({ _id: "second" as Id<"leaves">, _creationTime: 2 })]);
    const first = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...filters, paginationOpts: { numItems: 1, cursor: null } });
    const next = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...filters, paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect([...first.page, ...next.page].map(row => row._id)).toEqual(["second", leaveId]);
  });
  it("marks capped summaries partial and rejects incomplete calendar arrays", async () => {
    const f = fixture(Array.from({ length: 5001 }, (_, n) => savedLeave({ _id: `leave-${n}` as Id<"leaves"> })));
    expect(await invoke(summary, f.ctx, filters)).toEqual({ recordCount: 5000, employeeCount: 1, truncated: true, scannedCount: 5001 });
    await expect(invoke(listForRange, f.ctx, { projectId, startDate: filters.rangeStart, endDate: filters.rangeEnd })).rejects.toMatchObject(errorData("LEAVE_SCAN_LIMIT"));
  });
  it("applies the calendar candidate limit independently to each allowed project", async () => {
    const f = fixture(["project", "second-project"].flatMap(project => Array.from({ length: 3000 }, (_, n) =>
      savedLeave({ _id: `${project}-${n}` as Id<"leaves">, projectId: project as Id<"projects"> }))));
    f.ctx.user.role = "super_admin";
    f.ctx.allowedProjectIds = ["project", "second-project"];
    const result = await invoke<FunctionReturnType<typeof api.leaves.listForRange>>(listForRange, f.ctx, {
      startDate: filters.rangeStart, endDate: filters.rangeEnd,
    });
    expect(result).toHaveLength(6000);
    expect(result.every(row => row.notes === "Eski not")).toBe(true);
    f.tables.leaves.push(...Array.from({ length: 2001 }, (_, n) => savedLeave({ _id: `extra-${n}` as Id<"leaves"> })));
    await expect(invoke(listForRange, f.ctx, { startDate: filters.rangeStart, endDate: filters.rangeEnd }))
      .rejects.toMatchObject(errorData("LEAVE_SCAN_LIMIT"));
  });
  it.each(["project_user", "project_admin", "super_admin"])("masks only paginated notes for %s", async role => {
    const f = fixture([savedLeave()]);
    f.ctx.user.role = role;
    const page = await invoke<FunctionReturnType<typeof api.leaves.listPage>>(listPage, f.ctx, { ...filters, paginationOpts });
    expect(page.page[0].notesHidden).toBe(role === "project_user");
    expect(page.page[0].notes).toBe(role === "project_user" ? undefined : "Eski not");
    expect(await invoke(list, f.ctx, { projectId })).toMatchObject([{ notes: "Eski not" }]);
    expect(await invoke(listForRange, f.ctx, { projectId, startDate: filters.rangeStart, endDate: filters.rangeEnd }))
      .toMatchObject([{ notes: "Eski not" }]);
  });
  it("rejects inaccessible query scopes, invalid dates and invalid page sizes", async () => {
    const f = fixture();
    await expect(invoke(listPage, f.ctx, { ...filters, projectId: "other", paginationOpts })).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    await expect(invoke(summary, f.ctx, { ...filters, projectId: "other" })).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    await expect(invoke(listPage, f.ctx, { ...filters, rangeEnd: "2026-02-30", paginationOpts })).rejects.toMatchObject(errorData("LEAVE_INVALID_DATE"));
    await expect(invoke(listPage, f.ctx, { ...filters, paginationOpts: { numItems: 201, cursor: null } })).rejects.toMatchObject(errorData("LEAVE_INVALID_PAGE_SIZE"));
  });
  it("provides capped active-person options with Turkish name/department search", async () => {
    const f = fixture();
    f.tables.employees.push({ ...f.tables.employees[0], _id: "inactive", isActive: false }, { ...f.tables.employees[0], _id: "visitor", isVisitor: true });
    expect(await invoke(employeeOptions, f.ctx, { projectId, search: "ÜRETİM" })).toEqual({ options: [{ _id: employeeId, employeeName: "Ada Test", departmentName: "Üretim" }], truncated: false });
    f.tables.employees = Array.from({ length: 1001 }, (_, n) => ({ ...f.tables.employees[0], _id: `employee-${n}` }));
    const options = await invoke<FunctionReturnType<typeof api.leaves.employeeOptions>>(employeeOptions, f.ctx, { projectId });
    expect(options.options).toHaveLength(50); expect(options.truncated).toBe(true);
    await expect(invoke(employeeOptions, f.ctx, { projectId: "other" })).rejects.toThrow("Bu projeye erişim yetkiniz yok");
  });
});
