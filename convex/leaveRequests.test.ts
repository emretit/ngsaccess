import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import * as leaveRequests from "./leaveRequests";

vi.mock("./lib/customFunctions", () => ({
  employeeAuthedMutation: (definition: { handler: unknown }) => ({ _handler: definition.handler }),
  employeeAuthedQuery: (definition: { handler: unknown }) => ({ _handler: definition.handler }),
}));

type Row = Record<string, unknown> & { _id: string; _creationTime: number; table: string };
type Context = MutationCtx & { employee: Doc<"employees"> };
type Handler = (ctx: Context, args: Record<string, unknown>) => Promise<unknown>;
const handler = (fn: unknown): Handler => (fn as { _handler: Handler })._handler;

function fixture() {
  const employeeId = "employee-1" as Id<"employees">;
  const otherId = "employee-2" as Id<"employees">;
  const projectId = "project-1" as Id<"projects">;
  const employee = { _id: employeeId, _creationTime: 1, projectId, firstName: "Ada", lastName: "Yılmaz", email: "ada@test", cardNumber: "1" } as Doc<"employees">;
  const rows: Row[] = [employee as unknown as Row];
  let next = 0;
  const query = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const q = {
      eq: (field: string, value: unknown) => { filters.push(row => row[field] === value); return q; },
      gte: (field: string, value: string) => { filters.push(row => String(row[field]) >= value); return q; },
      lte: (field: string, value: string) => { filters.push(row => String(row[field]) <= value); return q; },
    };
    const chain = {
      withIndex: (_name: string, build: (builder: typeof q) => unknown) => { build(q); return chain; },
      order: () => chain,
      take: async (count: number) => rows.filter(row => row.table === table && filters.every(filter => filter(row))).slice(0, count),
      first: async () => rows.find(row => row.table === table && filters.every(filter => filter(row))) ?? null,
    };
    return chain;
  };
  const insert = vi.fn(async (table: string, value: Record<string, unknown>) => {
    const id = `${table}-${++next}`;
    rows.push({ ...value, _id: id, _creationTime: Date.now(), table });
    return id;
  });
  const get = vi.fn(async (id: string) => rows.find(row => row._id === id) ?? null);
  const deleteRow = vi.fn(async (id: string) => { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); });
  const patch = vi.fn(async (id: string, value: Record<string, unknown>) => { const row = rows.find(item => item._id === id); if (row) Object.assign(row, value); });
  const ctx = { employee, db: { query, insert, get, delete: deleteRow, patch } } as unknown as Context;
  return { ctx, rows, insert, get, deleteRow, employeeId, otherId, projectId };
}

const today = () => new Date().toISOString().slice(0, 10);
const submit = handler(leaveRequests.submit);
const withdraw = handler(leaveRequests.withdraw);
const listMine = handler(leaveRequests.listMine);

describe("leaveRequests", () => {
  it("submits from employee context, creates searchable audit, and lists only the current employee", async () => {
    const f = fixture();
    const id = await submit(f.ctx, { leaveType: "annual", startDate: today(), endDate: today() }) as string;
    expect(await listMine(f.ctx, {})).toEqual([expect.objectContaining({ _id: id, employeeId: f.employeeId, projectId: f.projectId, source: "employee" })]);
    const otherCtx = { ...f.ctx, employee: { ...f.ctx.employee, _id: f.otherId } } as Context;
    expect(await listMine(otherCtx, {})).toEqual([]);
    const audit = f.rows.find(row => row.table === "auditLog");
    expect(audit).toMatchObject({ targetTable: "leaves", targetId: id, note: "Çalışan talebi", searchText: expect.stringContaining("izin") });
    expect(audit?.newValue).toMatchObject({ actorType: "employee", employeeId: f.employeeId });
  });

  it("rejects overlap, dates older than 30 days, and ranges longer than 60 days", async () => {
    const f = fixture();
    const date = today();
    f.rows.push({ table: "leaves", _id: "approved", _creationTime: 1, employeeId: f.employeeId, startDate: date, endDate: date, status: "approved" });
    await expect(submit(f.ctx, { leaveType: "annual", startDate: date, endDate: date })).rejects.toThrow("çakışıyor");
    const old = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
    await expect(submit(f.ctx, { leaveType: "annual", startDate: old, endDate: old })).rejects.toThrow();
    const longEnd = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await expect(submit(f.ctx, { leaveType: "annual", startDate: date, endDate: longEnd })).rejects.toThrow("60 gün");
  });

  it("rejects overlapping pending requests and caps each employee at ten pending requests", async () => {
    const f = fixture();
    const date = today();
    f.rows.push({ table: "leaves", _id: "pending-overlap", _creationTime: 1, employeeId: f.employeeId, startDate: date, endDate: date, status: "pending" });
    await expect(submit(f.ctx, { leaveType: "annual", startDate: date, endDate: date })).rejects.toThrow("bekleyen başka bir izin");

    f.rows.splice(f.rows.findIndex(row => row._id === "pending-overlap"), 1);
    for (let index = 0; index < 10; index += 1) {
      f.rows.push({ table: "leaves", _id: `pending-${index}`, _creationTime: index + 1, employeeId: f.employeeId, startDate: "2099-01-01", endDate: "2099-01-01", status: "pending" });
    }
    const nextDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await expect(submit(f.ctx, { leaveType: "annual", startDate: nextDate, endDate: nextDate })).rejects.toThrow("En fazla 10");
  });

  it("withdraws only own pending employee requests", async () => {
    const f = fixture();
    const id = await submit(f.ctx, { leaveType: "annual", startDate: today(), endDate: today() }) as Id<"leaves">;
    const otherCtx = { ...f.ctx, employee: { ...f.ctx.employee, _id: f.otherId } } as Context;
    await expect(withdraw(otherCtx, { leaveId: id })).rejects.toThrow("erişim");
    await withdraw(f.ctx, { leaveId: id });
    for (const [status, source] of [["approved", "employee"], ["pending", "admin"]]) {
      const protectedId = await f.insert("leaves", { employeeId: f.employeeId, projectId: f.projectId, leaveType: "annual", startDate: today(), endDate: today(), status, source, createdAt: today(), updatedAt: today() }) as Id<"leaves">;
      await expect(withdraw(f.ctx, { leaveId: protectedId })).rejects.toThrow();
    }
  });
});
