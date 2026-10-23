import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import * as attendanceCorrections from "./attendanceCorrections";

vi.mock("./lib/customFunctions", () => {
  const pass = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  const admin = (definition: { handler: unknown }) => ({ _handler: async (ctx: TestContext, args: Record<string, unknown>) => {
    if (ctx.user.role === "project_user") throw new Error("Bu işlem için yetkiniz yok");
    return (definition.handler as Handler)(ctx, args);
  } });
  return { employeeAuthedMutation: pass, employeeAuthedQuery: pass, authedMutation: pass, authedQuery: pass, };
});
vi.mock("./lib/auth", async importOriginal => {
  const original = await importOriginal<typeof import("./lib/auth")>();
  return { ...original, getProjectIdsForUser: async (ctx: TestContext) => ctx.user.role === "super_admin" ? [ctx.projectId, ctx.otherProjectId] : ctx.memberships };
});
vi.mock("./lib/shiftResolver", () => ({
  buildShiftResolver: async () => ({ resolve: () => ({ projectId: "project-1", startTime: "22:00", endTime: "06:00" }), resolveLast: () => ({ projectId: "project-1", startTime: "22:00", endTime: "06:00" }) }),
}));

type Row = Record<string, unknown> & { _id: string; _creationTime: number; table: string };
type User = Doc<"users">;
type TestContext = MutationCtx & { employee: Doc<"employees">; user: User; memberships: Id<"projects">[]; projectId: Id<"projects">; otherProjectId: Id<"projects"> };
type Handler = (ctx: TestContext, args: Record<string, unknown>) => Promise<unknown>;
const handler = (fn: unknown): Handler => (fn as { _handler: Handler })._handler;

function fixture(role: User["role"] = "project_admin", memberships: Id<"projects">[] = ["project-1" as Id<"projects">]) {
  const employeeId = "employee-1" as Id<"employees">;
  const projectId = "project-1" as Id<"projects">;
  const otherProjectId = "project-2" as Id<"projects">;
  const employee = { _id: employeeId, _creationTime: 1, projectId, firstName: "Ada", lastName: "Yılmaz", email: "ada@test", cardNumber: "1" } as Doc<"employees">;
  const user = { _id: "user-1" as Id<"users">, _creationTime: 1, role } as User;
  const rows: Row[] = [employee as unknown as Row];
  let next = 0;
  const query = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const q = { eq: (field: string, value: unknown) => { filters.push(row => row[field] === value); return q; }, gte: (field: string, value: string) => { filters.push(row => String(row[field]) >= value); return q; } };
    const selected = () => (table === "userProjects" ? memberships.map(projectId => ({ _id: `m-${projectId}`, _creationTime: 1, table, userId: user._id, projectId })) : rows).filter(row => row.table === table && filters.every(filter => filter(row)));
    const chain = {
      withIndex: (_name: string, build: (builder: typeof q) => unknown) => { build(q); return chain; }, order: () => chain,
      take: async (count: number) => selected().slice(0, count), first: async () => selected()[0] ?? null, unique: async () => selected()[0] ?? null,
    };
    return chain;
  };
  const insert = vi.fn(async (table: string, value: Record<string, unknown>) => {
    const id = `${table}-${++next}`; rows.push({ ...value, _id: id, _creationTime: Date.now(), table }); return id;
  });
  const get = vi.fn(async (id: string) => rows.find(row => row._id === id) ?? null);
  const patch = vi.fn(async (id: string, value: Record<string, unknown>) => { const row = rows.find(item => item._id === id); if (row) Object.assign(row, value); });
  const del = vi.fn(async (id: string) => { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); });
  const ctx = { employee, user, memberships, projectId, otherProjectId, db: { query, insert, get, patch, delete: del } } as unknown as TestContext;
  const asEmployee = (id: Id<"employees">) => ({ ...ctx, employee: { ...employee, _id: id } } as TestContext);
  return { ctx, asEmployee, rows, insert, get, patch, del, employeeId, projectId, otherProjectId };
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const submit = handler(attendanceCorrections.submit);
const withdraw = handler(attendanceCorrections.withdraw);
const listMine = handler(attendanceCorrections.listMine);
const listPending = handler(attendanceCorrections.listPending);
const approve = handler(attendanceCorrections.approve);
const reject = handler(attendanceCorrections.reject);
const args = (date = today()) => ({ date, correctionType: "both", requestedCheckIn: "08:00", requestedCheckOut: "17:00", reason: "Saat düzeltme gerekçesi" });

describe("attendanceCorrections", () => {
  it("validates submit, blocks duplicate pending dates, lists only own items, and audits", async () => {
    const f = fixture();
    const id = await submit(f.asEmployee(f.employeeId), args()) as string;
    await expect(submit(f.asEmployee(f.employeeId), args())).rejects.toThrow("bekleyen");
    await expect(submit(f.asEmployee(f.employeeId), { ...args(), reason: "yok" })).rejects.toThrow("5–300");
    await expect(submit(f.asEmployee(f.employeeId), { ...args(), correctionType: "checkIn", requestedCheckIn: undefined })).rejects.toThrow("uygun");
    const old = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
    await expect(submit(f.asEmployee(f.employeeId), args(old))).rejects.toThrow("son 30 gün");
    expect(await listMine(f.asEmployee(f.employeeId), {})).toMatchObject([expect.objectContaining({ _id: id, employeeId: f.employeeId })]);
    expect(await listMine(f.asEmployee("employee-2" as Id<"employees">), {})).toEqual([]);
    const audit = f.rows.find(row => row.table === "auditLog");
    expect(audit).toMatchObject({ targetTable: "attendanceCorrections", note: "Çalışan talebi", searchText: expect.stringContaining("düzeltme") });
    expect(audit?.newValue).toMatchObject({ actorType: "employee", employeeId: f.employeeId });
  });

  it("withdraws own pending requests and isolates pending lists by project", async () => {
    const f = fixture();
    const id = await submit(f.asEmployee(f.employeeId), args()) as Id<"attendanceCorrections">;
    await expect(withdraw(f.asEmployee("employee-2" as Id<"employees">), { id })).rejects.toThrow("erişim");
    await withdraw(f.asEmployee(f.employeeId), { id });
    const secondId = await f.insert("attendanceCorrections", { employeeId: f.employeeId, projectId: f.projectId, date: today(), correctionType: "both", requestedCheckIn: "08:00", requestedCheckOut: "17:00", reason: "Gerekçe yeterli", status: "pending", createdAt: today(), updatedAt: today() });
    const page = await listPending(f.ctx, { paginationOpts: { numItems: 20, cursor: null } }) as { page: Row[] };
    expect(page.page.map(row => row._id)).toContain(secondId);
    await expect(listPending({ ...f.ctx, memberships: [] }, { paginationOpts: { numItems: 20, cursor: null }, projectId: f.projectId })).rejects.toThrow("yetkiniz");
  });

  it("approves into PDKS and audits; rejects require a note", async () => {
    const f = fixture();
    const id = await submit(f.asEmployee(f.employeeId), args()) as Id<"attendanceCorrections">;
    await expect(reject(f.ctx, { id, note: "  " })).rejects.toThrow("en az 3");
    await approve(f.ctx, { id });
    expect(f.rows.find(row => row._id === id)).toMatchObject({ status: "approved", decidedBy: f.ctx.user._id });
    expect(f.rows.find(row => row.table === "pdksRecords")).toMatchObject({ employeeId: f.employeeId, projectId: f.projectId, entryTime: "08:00", exitTime: "17:00", status: "present", manualEntry: true });
    expect(f.rows.filter(row => row.table === "auditLog").map(row => row.targetTable)).toContain("pdksRecords");
    const rejectedId = await submit(f.asEmployee(f.employeeId), { ...args(), date: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) }) as Id<"attendanceCorrections">;
    await reject(f.ctx, { id: rejectedId, note: "Uygun değil" });
    expect(f.rows.find(row => row._id === rejectedId)).toMatchObject({ status: "rejected", decisionNote: "Uygun değil" });
  });

  it("keeps the existing counterpart time for one-way approvals and accepts overnight shifts", async () => {
    const f = fixture();
    const checkInDate = today();
    f.rows.push({ table: "pdksRecords", _id: "pdks-in", _creationTime: 1, employeeId: f.employeeId, projectId: f.projectId, date: checkInDate, entryTime: "08:00", exitTime: "17:05", status: "present" });
    const checkInId = await submit(f.asEmployee(f.employeeId), { date: checkInDate, correctionType: "checkIn", requestedCheckIn: "08:10", reason: "Giriş saati düzeltmesi" }) as Id<"attendanceCorrections">;
    await approve(f.ctx, { id: checkInId });
    expect(f.rows.find(row => row._id === "pdks-in")).toMatchObject({ entryTime: "08:10", exitTime: "17:05" });

    const checkOutDate = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    f.rows.push({ table: "pdksRecords", _id: "pdks-out", _creationTime: 2, employeeId: f.employeeId, projectId: f.projectId, date: checkOutDate, entryTime: "08:05", exitTime: "17:00", status: "present" });
    const checkOutId = await submit(f.asEmployee(f.employeeId), { date: checkOutDate, correctionType: "checkOut", requestedCheckOut: "17:10", reason: "Çıkış saati düzeltmesi" }) as Id<"attendanceCorrections">;
    await approve(f.ctx, { id: checkOutId });
    expect(f.rows.find(row => row._id === "pdks-out")).toMatchObject({ entryTime: "08:05", exitTime: "17:10" });

    const overnightDate = new Date(Date.now() - 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    const overnightId = await submit(f.asEmployee(f.employeeId), { date: overnightDate, correctionType: "both", requestedCheckIn: "22:00", requestedCheckOut: "06:00", reason: "Gece vardiyası düzeltmesi" }) as Id<"attendanceCorrections">;
    await expect(approve(f.ctx, { id: overnightId })).resolves.toBeNull();
    expect(f.rows.find(row => row.table === "pdksRecords" && row.date === overnightDate)).toMatchObject({ entryTime: "22:00", exitTime: "06:00" });
  });

  it("signals when a project reaches the documented pending-list cap", async () => {
    const f = fixture();
    for (let index = 0; index < 200; index += 1) {
      f.rows.push({ table: "attendanceCorrections", _id: `pending-${index}`, _creationTime: index, employeeId: f.employeeId, projectId: f.projectId, date: today(), status: "pending" });
    }
    const page = await listPending(f.ctx, { paginationOpts: { numItems: 100, cursor: "100" } }) as { isDone: boolean; hasMore: boolean; page: Row[] };
    expect(page.page).toHaveLength(100);
    expect(page.hasMore).toBe(true);
    expect(page.isDone).toBe(false);
  });

  it("blocks project_user and out-of-scope project admins from decisions", async () => {
    const f = fixture();
    const id = await f.insert("attendanceCorrections", { employeeId: f.employeeId, projectId: f.projectId, date: today(), correctionType: "both", requestedCheckIn: "08:00", requestedCheckOut: "17:00", reason: "Gerekçe yeterli", status: "pending", createdAt: today(), updatedAt: today() }) as Id<"attendanceCorrections">;
    await expect(handler(attendanceCorrections.approve)({ ...f.ctx, user: { ...f.ctx.user, role: "project_user" } as User }, { id })).rejects.toThrow("yetkiniz");
    await expect(approve({ ...f.ctx, memberships: [f.otherProjectId] }, { id })).rejects.toThrow("erişim");
    expect(f.rows.find(row => row._id === id)).toMatchObject({ status: "pending" });
  });
});
