import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import * as leaveRequests from "./leaveRequests";

vi.mock("./lib/customFunctions", () => ({
  authedQuery: (definition: { handler: unknown }) => ({
    _handler: definition.handler,
  }),
  authedMutation: (definition: { handler: unknown }) => ({
    _handler: definition.handler,
  }),
  employeeAuthedMutation: (definition: { handler: unknown }) => ({
    _handler: definition.handler,
  }),
  employeeAuthedQuery: (definition: { handler: unknown }) => ({
    _handler: definition.handler,
  }),
}));

type Row = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
  table: string;
};
type Context = MutationCtx & { employee: Doc<"employees">; user: Doc<"users"> };
type Handler = (
  ctx: Context,
  args: Record<string, unknown>,
) => Promise<unknown>;
const handler = (fn: unknown): Handler =>
  (fn as { _handler: Handler })._handler;

function fixture() {
  const employeeId = "employee-1" as Id<"employees">;
  const otherId = "employee-2" as Id<"employees">;
  const projectId = "project-1" as Id<"projects">;
  const employee = {
    _id: employeeId,
    _creationTime: 1,
    projectId,
    firstName: "Ada",
    lastName: "Yılmaz",
    email: "ada@test",
    cardNumber: "1",
  } as Doc<"employees">;
  const rows: Row[] = [employee as unknown as Row];
  const user = {
    _id: "admin-1" as Id<"users">,
    role: "project_admin",
    email: "admin@test",
  } as Doc<"users">;
  rows.push({
    table: "userProjects",
    _id: "membership",
    _creationTime: 1,
    userId: user._id,
    projectId,
  });
  let next = 0;
  const query = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const q = {
      eq: (field: string, value: unknown) => {
        filters.push((row) => row[field] === value);
        return q;
      },
      gte: (field: string, value: string) => {
        filters.push((row) => String(row[field]) >= value);
        return q;
      },
      lte: (field: string, value: string) => {
        filters.push((row) => String(row[field]) <= value);
        return q;
      },
    };
    const chain = {
      withIndex: (_name: string, build: (builder: typeof q) => unknown) => {
        build(q);
        return chain;
      },
      unique: async () => rows.find(row => row.table === table && filters.every(filter => filter(row))) ?? null,
      order: () => chain,
      take: async (count: number) =>
        rows
          .filter(
            (row) =>
              row.table === table && filters.every((filter) => filter(row)),
          )
          .slice(0, count),
      collect: async () =>
        rows.filter(
          (row) =>
            row.table === table && filters.every((filter) => filter(row)),
        ),
      paginate: async (opts: { numItems: number; cursor: string | null }) => {
        const start = Number(opts.cursor ?? 0);
        const matched = rows.filter(
          (row) =>
            row.table === table && filters.every((filter) => filter(row)),
        );
        const page = matched.slice(start, start + opts.numItems);
        return {
          page,
          isDone: start + page.length >= matched.length,
          continueCursor: String(start + page.length),
        };
      },
      first: async () =>
        rows.find(
          (row) =>
            row.table === table && filters.every((filter) => filter(row)),
        ) ?? null,
    };
    return chain;
  };
  const insert = vi.fn(
    async (table: string, value: Record<string, unknown>) => {
      const id = `${table}-${++next}`;
      rows.push({ ...value, _id: id, _creationTime: Date.now(), table });
      return id;
    },
  );
  const get = vi.fn(
    async (id: string) => rows.find((row) => row._id === id) ?? null,
  );
  const deleteRow = vi.fn(async (id: string) => {
    const index = rows.findIndex((row) => row._id === id);
    if (index >= 0) rows.splice(index, 1);
  });
  const patch = vi.fn(async (id: string, value: Record<string, unknown>) => {
    const row = rows.find((item) => item._id === id);
    if (row) Object.assign(row, value);
  });
  const ctx = {
    employee,
    user,
    db: { query: vi.fn(query), insert, get, delete: deleteRow, patch },
  } as unknown as Context;
  return { ctx, rows, insert, get, deleteRow, employeeId, otherId, projectId };
}

const today = () => new Date().toISOString().slice(0, 10);
const submit = handler(leaveRequests.submit);
const withdraw = handler(leaveRequests.withdraw);
const listMine = handler(leaveRequests.listMine);

describe("leaveRequests", () => {
  it("submits from employee context, creates searchable audit, and lists only the current employee", async () => {
    const f = fixture();
    const id = (await submit(f.ctx, {
      leaveType: "annual",
      startDate: today(),
      endDate: today(),
    })) as string;
    expect(await listMine(f.ctx, {})).toEqual([
      expect.objectContaining({
        _id: id,
        employeeId: f.employeeId,
        projectId: f.projectId,
        source: "employee",
      }),
    ]);
    const otherCtx = {
      ...f.ctx,
      employee: { ...f.ctx.employee, _id: f.otherId },
    } as Context;
    expect(await listMine(otherCtx, {})).toEqual([]);
    const audit = f.rows.find((row) => row.table === "auditLog");
    expect(audit).toMatchObject({
      targetTable: "leaves",
      targetId: id,
      note: "Çalışan talebi",
      searchText: expect.stringContaining("izin"),
    });
    expect(audit?.newValue).toMatchObject({
      actorType: "employee",
      employeeId: f.employeeId,
    });
  });

  it("rejects overlap, dates older than 30 days, and ranges longer than 60 days", async () => {
    const f = fixture();
    const date = today();
    f.rows.push({
      table: "leaves",
      _id: "approved",
      _creationTime: 1,
      employeeId: f.employeeId,
      startDate: date,
      endDate: date,
      status: "approved",
    });
    await expect(
      submit(f.ctx, { leaveType: "annual", startDate: date, endDate: date }),
    ).rejects.toThrow("çakışıyor");
    const old = new Date(Date.now() - 31 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await expect(
      submit(f.ctx, { leaveType: "annual", startDate: old, endDate: old }),
    ).rejects.toThrow();
    const longEnd = new Date(Date.now() + 60 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await expect(
      submit(f.ctx, { leaveType: "annual", startDate: date, endDate: longEnd }),
    ).rejects.toThrow("60 gün");
  });

  it("rejects overlapping pending requests and caps each employee at ten pending requests", async () => {
    const f = fixture();
    const date = today();
    f.rows.push({
      table: "leaves",
      _id: "pending-overlap",
      _creationTime: 1,
      employeeId: f.employeeId,
      startDate: date,
      endDate: date,
      status: "pending",
    });
    await expect(
      submit(f.ctx, { leaveType: "annual", startDate: date, endDate: date }),
    ).rejects.toThrow("bekleyen başka bir izin");

    f.rows.splice(
      f.rows.findIndex((row) => row._id === "pending-overlap"),
      1,
    );
    for (let index = 0; index < 10; index += 1) {
      f.rows.push({
        table: "leaves",
        _id: `pending-${index}`,
        _creationTime: index + 1,
        employeeId: f.employeeId,
        startDate: "2099-01-01",
        endDate: "2099-01-01",
        status: "pending",
      });
    }
    const nextDate = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    await expect(
      submit(f.ctx, {
        leaveType: "annual",
        startDate: nextDate,
        endDate: nextDate,
      }),
    ).rejects.toThrow("En fazla 10");
  });

  it("withdraws only own pending employee requests", async () => {
    const f = fixture();
    const id = (await submit(f.ctx, {
      leaveType: "annual",
      startDate: today(),
      endDate: today(),
    })) as Id<"leaves">;
    const otherCtx = {
      ...f.ctx,
      employee: { ...f.ctx.employee, _id: f.otherId },
    } as Context;
    await expect(withdraw(otherCtx, { leaveId: id })).rejects.toThrow("erişim");
    await withdraw(f.ctx, { leaveId: id });
    for (const [status, source] of [
      ["approved", "employee"],
      ["pending", "admin"],
    ]) {
      const protectedId = (await f.insert("leaves", {
        employeeId: f.employeeId,
        projectId: f.projectId,
        leaveType: "annual",
        startDate: today(),
        endDate: today(),
        status,
        source,
        createdAt: today(),
        updatedAt: today(),
      })) as Id<"leaves">;
      await expect(withdraw(f.ctx, { leaveId: protectedId })).rejects.toThrow();
    }
  });
});

describe("leaveRequests yönetici kararları", () => {
  const listPending = handler(leaveRequests.listPending);
  const pendingCount = handler(leaveRequests.pendingCount);
  const approve = handler(leaveRequests.approve);
  const reject = handler(leaveRequests.reject);
  async function pending(f: ReturnType<typeof fixture>) {
    return f.insert("leaves", {
      employeeId: f.employeeId,
      projectId: f.projectId,
      leaveType: "annual",
      startDate: today(),
      endDate: today(),
      status: "pending",
      source: "employee",
      notes: "Çalışanın özgün notu",
      createdAt: today(),
      updatedAt: today(),
    });
  }
  it("lists only project pending requests with employee, department, days and pagination capped at 100", async () => {
    const f = fixture();
    Object.assign(f.rows[0], { departmentId: "department-1" });
    f.rows.push({
      table: "departments",
      _id: "department-1",
      _creationTime: 1,
      projectId: f.projectId,
      name: "Operasyon",
    });
    await pending(f);
    const result = await listPending(f.ctx, {
      projectId: f.projectId,
      paginationOpts: { numItems: 200, cursor: null },
    });
    expect(result).toMatchObject({
      page: [
        {
          employeeName: "Ada Yılmaz",
          departmentName: "Operasyon",
          calendarDays: 1,
        },
      ],
    });
    for (let i = 0; i < 105; i++) await pending(f);
    const large = (await listPending(f.ctx, {
      projectId: f.projectId,
      paginationOpts: { numItems: 200, cursor: null },
    })) as { page: unknown[]; isDone: boolean };
    expect(large.page).toHaveLength(100);
    expect(large.isDone).toBe(false);
    await expect(
      listPending(f.ctx, {
        projectId: "other",
        paginationOpts: { numItems: 25, cursor: null },
      }),
    ).rejects.toThrow("erişim");
    await expect(pendingCount(f.ctx, { projectId: "other", kind: "leaves" })).rejects.toThrow(
      "erişim",
    );
  });
  it("approves pending leave, preserves employee notes and writes decision audit", async () => {
    const f = fixture();
    const id = await pending(f);
    await approve(f.ctx, { leaveId: id, note: "Uygundur" });
    expect(await f.get(id)).toMatchObject({
      status: "approved",
      approvedBy: f.ctx.user._id,
      notes: "Çalışanın özgün notu",
      decisionNote: "Uygundur",
      decidedAt: expect.any(String),
    });
    expect(f.rows.find((row) => row.table === "auditLog")).toMatchObject({
      targetId: id,
      action: "update",
      note: "Uygundur",
    });
    await expect(approve(f.ctx, { leaveId: id })).rejects.toThrow("bekleyen");
    await expect(
      reject(f.ctx, { leaveId: id, note: "Uygun değil" }),
    ).rejects.toThrow("bekleyen");
  });
  it("rejects with a required trimmed reason and preserves notes", async () => {
    const f = fixture();
    const id = await pending(f);
    for (const note of ["ab", "   ", "x".repeat(501)])
      await expect(reject(f.ctx, { leaveId: id, note })).rejects.toThrow(
        "3–500",
      );
    await reject(f.ctx, { leaveId: id, note: "  Uygun değil  " });
    expect(await f.get(id)).toMatchObject({
      status: "rejected",
      notes: "Çalışanın özgün notu",
      decisionNote: "Uygun değil",
      decidedAt: expect.any(String),
    });
  });
  it("blocks project access, employee project mismatch and approved overlap", async () => {
    const f = fixture();
    const id = await pending(f);
    const row = f.rows.find((row) => row._id === id);
    if (!row) throw new Error("fixture missing");
    row.projectId = "other";
    await expect(approve(f.ctx, { leaveId: id })).rejects.toThrow("erişim");
    await expect(
      reject(f.ctx, { leaveId: id, note: "Uygun değil" }),
    ).rejects.toThrow("erişim");
    row.projectId = f.projectId;
    Object.assign(f.rows[0], { projectId: "other" });
    await expect(approve(f.ctx, { leaveId: id })).rejects.toThrow("eşleşmiyor");
    Object.assign(f.rows[0], { projectId: f.projectId });
    await f.insert("leaves", {
      employeeId: f.employeeId,
      projectId: f.projectId,
      status: "approved",
      startDate: today(),
      endDate: today(),
    });
    await expect(approve(f.ctx, { leaveId: id })).rejects.toThrow("çakış");
    expect(await f.get(id)).toMatchObject({ status: "pending" });
  });
  it.each(["leaves", "corrections"])("counts only %s within the project with a 101-row limit", async (kind) => {
    const f = fixture();
    const table = kind === "leaves" ? "leaves" : "attendanceCorrections";
    expect(await pendingCount(f.ctx, { projectId: f.projectId, kind })).toEqual({ count: 0, capped: false });
    await f.insert(table, { projectId: "other", status: "pending" });
    await f.insert(table, { projectId: f.projectId, status: "approved" });
    await f.insert(table, { projectId: f.projectId, status: "pending" });
    expect(await pendingCount(f.ctx, { projectId: f.projectId, kind })).toEqual({ count: 1, capped: false });
    for (let i = 0; i < 105; i++)
      await f.insert(table, { projectId: f.projectId, status: "pending" });
    vi.mocked(f.ctx.db.query).mockClear();
    expect(await pendingCount(f.ctx, { projectId: f.projectId, kind })).toEqual({ count: 101, capped: true });
    expect(vi.mocked(f.ctx.db.query).mock.calls.map(([table]) => table)).toEqual(["userProjects", "userProjects", table]);
  });
  it("checks only the selected project for super admin counts", async () => {
    const f = fixture();
    f.ctx.user.role = "super_admin";
    f.rows.push({ table: "projects", _id: f.projectId, _creationTime: 1 });
    expect(await pendingCount(f.ctx, { projectId: f.projectId, kind: "leaves" })).toEqual({ count: 0, capped: false });
    expect(f.get).toHaveBeenCalledWith(f.projectId);
    expect(vi.mocked(f.ctx.db.query).mock.calls.map(([table]) => table)).toEqual(["leaves"]);
    await expect(pendingCount(f.ctx, { projectId: "missing", kind: "corrections" })).rejects.toThrow("erişim");
  });
  it("keeps invalid legacy dates from breaking the pending queue", async () => {
    const f = fixture();
    await pending(f);
    for (const [startDate, endDate] of [["bad-date", today()], ["2026-02-30", "2026-03-01"], ["2026-10-22", "2026-10-21"]]) {
      await f.insert("leaves", { employeeId: f.employeeId, projectId: f.projectId, status: "pending", startDate, endDate });
    }
    expect(await listPending(f.ctx, { projectId: f.projectId, paginationOpts: { cursor: null, numItems: 25 } })).toMatchObject({
      page: [{ calendarDays: 1 }, { calendarDays: null }, { calendarDays: null }, { calendarDays: null }],
    });
  });
});
