/// <reference types="vite/client" />
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { getFunctionName } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import * as employeeImport from "./employeeImport";
import type { Doc, Id } from "./_generated/dataModel";
import type { EmployeeImportRow } from "./lib/employeeImportValidation";

const row = (overrides: Partial<EmployeeImportRow> = {}): EmployeeImportRow => ({
  rowNumber: 2, firstName: "Ada", lastName: "Yılmaz", email: "ada@example.com", cardNumber: "A-1", ...overrides,
});
type TestCtx = MutationCtx & { user: Doc<"users">; memberships: Id<"projects">[] };
type Handler = (ctx: TestCtx, args: unknown) => Promise<unknown>;
vi.mock("./lib/customFunctions", () => ({
  authedMutation: (definition: { handler: Handler }) => ({ _handler: async (ctx: TestCtx, args: unknown) => {
    if (!ctx.user) throw new Error("Giriş yapmanız gerekiyor");
    return definition.handler(ctx, args);
  } }),
}));
vi.mock("./lib/auth", async original => ({
  ...await original<typeof import("./lib/auth")>(),
  getProjectIdsForUser: async (ctx: TestCtx) => ctx.memberships,
}));
vi.mock("./lib/accessGraph", () => ({ resolveEmployeeIdeDeviceIds: async () => ["device-1"] }));
type StoredRow = Record<string, unknown> & { _id: string; _creationTime: number };
async function fixture(role: Doc<"users">["role"] = "project_admin") {
  const tables = new Map<string, StoredRow[]>();
  const table = (name: string) => { const rows = tables.get(name) ?? []; tables.set(name, rows); return rows; };
  let serial = 0;
  const insert = async (name: string, value: Record<string, unknown>) => {
    const id = `${name}-${++serial}`;
    table(name).push({ ...value, _id: id, _creationTime: serial }); return id;
  };
  const get = async (id: string) => [...tables.values()].flat().find(item => item._id === id) ?? null;
  const query = (name: string) => {
    const filters: [string, unknown][] = [];
    const builder = { eq: (field: string, value: unknown) => { filters.push([field, value]); return builder; } };
    const selected = () => table(name).filter(item => filters.every(([key, value]) => item[key] === value));
    const chain = {
      withIndex: (_index: string, callback: (q: typeof builder) => unknown) => { callback(builder); return chain; },
      unique: async () => selected()[0] ?? null, collect: async () => selected(), take: async (limit: number) => selected().slice(0, limit),
      [Symbol.asyncIterator]: async function* () { yield* selected(); },
    };
    return chain;
  };
  const db = { insert, get, query, patch: async (id: string, value: Record<string, unknown>) => {
    const record = await get(id); if (!record) throw new Error("Missing fixture row"); Object.assign(record, value);
  }, system: { query } };
  const userId = await insert("users", { name: "Yönetici", role }) as Id<"users">;
  const projectId = await insert("projects", { name: "Yetkili" }) as Id<"projects">;
  const otherProjectId = await insert("projects", { name: "Diğer" }) as Id<"projects">;
  await insert("userProjects", { userId, projectId });
  const schedule = vi.fn();
  const ctx = { db, user: await get(userId), memberships: [projectId], scheduler: { runAfter: schedule } } as unknown as TestCtx;
  const mutate = async <Ref extends FunctionReference<"mutation">>(fn: Ref, args: FunctionArgs<Ref>, authenticated = true): Promise<FunctionReturnType<Ref>> => {
    const functionName = getFunctionName(fn);
    const registered = functionName.endsWith(":importChunk") ? employeeImport.importChunk
      : functionName.endsWith(":logExport") ? employeeImport.logExport : employeeImport.assignCards;
    const handler = (registered as unknown as { _handler: Handler })._handler;
    return await handler(authenticated ? ctx : { ...ctx, user: undefined } as unknown as TestCtx, args) as FunctionReturnType<Ref>;
  };
  const t = { run: async <T>(fn: (context: MutationCtx) => Promise<T>) => fn(ctx),
    mutation: <Ref extends FunctionReference<"mutation">>(fn: Ref, args: FunctionArgs<Ref>) => mutate(fn, args, false) };
  const actor = { mutation: mutate };
  const employee = (owner: Id<"projects"> | undefined = projectId, overrides: Partial<Doc<"employees">> = {}) =>
    t.run(context => context.db.insert("employees", { projectId: owner, firstName: "Mevcut", lastName: "Kişi", email: "existing@example.com", cardNumber: "EXISTING", ...overrides }));
  const snapshot = () => t.run(async context => ({
    employees: await context.db.query("employees").collect(), audit: await context.db.query("auditLog").collect(),
    scheduled: schedule.mock.calls,
  }));
  return { t, actor, userId, projectId, otherProjectId, employee, snapshot };
}

describe("importChunk", () => {
  it("dryRun validates without writing employees, audits or device sync jobs", async () => {
    const f = await fixture();
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [row()], dryRun: true })).toMatchObject([{ status: "created" }]);
    expect(await f.snapshot()).toEqual({ employees: [], audit: [], scheduled: [] });
  });
  it.each(["department", "position", "company"] as const)("rejects a %s that exists only in another project", async field => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert(field === "department" ? "departments" : field === "position" ? "positions" : "companies", { name: "Yabancı", projectId: f.otherProjectId }));
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [row({ [field]: "Yabancı" })], dryRun: false })).toMatchObject([{ status: "error", message: expect.stringContaining("bu projede bulunamadı") }]);
    expect((await f.snapshot()).employees).toHaveLength(0);
  });
  it("rejects project_user and unauthenticated calls", async () => {
    const f = await fixture("project_user");
    const args = { projectId: f.projectId, rows: [row()], dryRun: false };
    await expect(f.actor.mutation(api.employeeImport.importChunk, args)).rejects.toThrow("yetkiniz yok");
    await expect(f.t.mutation(api.employeeImport.importChunk, args)).rejects.toThrow("Giriş yapmanız gerekiyor");
    expect(await f.snapshot()).toEqual({ employees: [], audit: [], scheduled: [] });
  });
  it("rejects an inaccessible project before writing", async () => {
    const f = await fixture();
    await expect(f.actor.mutation(api.employeeImport.importChunk, { projectId: f.otherProjectId, rows: [row()], dryRun: false })).rejects.toThrow("erişim yetkiniz yok");
    expect(await f.snapshot()).toEqual({ employees: [], audit: [], scheduled: [] });
  });
  it.each(["tcNo", "email", "cardNumber"] as const)("skips an existing same-project %s", async field => {
    const f = await fixture();
    const incoming = row({ tcNo: "10000000146" });
    await f.employee(f.projectId, { [field]: incoming[field] });
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [incoming], dryRun: false })).toMatchObject([{ status: "skippedDuplicate" }]);
    expect((await f.snapshot()).employees).toHaveLength(1);
  });
  it("skips identifiers already used in another project", async () => {
    const f = await fixture(); const incoming = row({ tcNo: "10000000146" });
    await f.employee(f.otherProjectId, { email: incoming.email, tcNo: incoming.tcNo, cardNumber: incoming.cardNumber });
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [incoming], dryRun: false })).toMatchObject([{ status: "skippedDuplicate" }]);
    expect((await f.snapshot()).employees).toHaveLength(1);
  });
  it.each(["tcNo", "email", "cardNumber"] as const)("finds a same-project %s after 20 other-project matches", async field => {
    const f = await fixture(); const incoming = row({ tcNo: "10000000146" });
    for (let i = 0; i < 21; i++) await f.employee(f.otherProjectId, { [field]: incoming[field] });
    await f.employee(f.projectId, { [field]: incoming[field] });
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [incoming], dryRun: false })).toMatchObject([{ status: "skippedDuplicate" }]);
    expect((await f.snapshot()).employees).toHaveLength(22);
  });
  it("reports the second in-file row without writing it during a real import", async () => {
    const f = await fixture();
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [row(), row({ rowNumber: 3 })], dryRun: false })).toMatchObject([{ status: "created" }, { status: "error" }]);
    const state = await f.snapshot();
    expect(state.employees).toHaveLength(1);
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]?.newValue).toEqual({ imported: 1, skipped: 0, errors: 1 });
  });
  it("writes a zero-count audit even for an empty non-dryRun call", async () => {
    const f = await fixture();
    await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [], dryRun: false });
    expect((await f.snapshot()).audit).toMatchObject([{ newValue: { imported: 0, skipped: 0, errors: 0 } }]);
  });
  it.each(["tcNo", "email", "cardNumber"] as const)("reports an in-file duplicate %s in dryRun", async field => {
    const f = await fixture();
    const first = row({ tcNo: "10000000146" });
    const second = row({ rowNumber: 3, email: "second@example.com", cardNumber: "SECOND", [field]: first[field] });
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [first, second], dryRun: true })).toMatchObject([{ status: "created" }, { status: "error", message: expect.stringContaining("satırda da kullanılıyor") }]);
    expect((await f.snapshot()).audit).toEqual([]);
  });
  it("accepts 100 rows and rejects 101 atomically", async () => {
    const f = await fixture();
    const rows = Array.from({ length: 100 }, (_, i) => row({ rowNumber: i + 2, email: `person${i}@example.com`, cardNumber: `CARD-${i}` }));
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows, dryRun: true })).toHaveLength(100);
    await expect(f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [...rows, row()], dryRun: false })).rejects.toThrow("en fazla 100");
    expect((await f.snapshot()).employees).toHaveLength(0);
  });
  it("uses the same default lowercase behavior as create for Turkish email letters", async () => {
    const f = await fixture();
    const email = "I@example.com";
    await f.employee(f.otherProjectId, { email });
    expect(await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, rows: [row({ email })], dryRun: false })).toMatchObject([{ status: "skippedDuplicate" }]);
  });
  it("resolves Turkish dotted and dotless I names and writes only one non-PII summary audit", async () => {
    const f = await fixture();
    const relations = await f.t.run(async ctx => ({
      departmentId: await ctx.db.insert("departments", { name: "İŞ Güvenliği", projectId: f.projectId }),
      positionId: await ctx.db.insert("positions", { name: "IŞIK", projectId: f.projectId }),
      companyId: await ctx.db.insert("companies", { name: "İNCİ", projectId: f.projectId }),
    }));
    await f.employee();
    const result = await f.actor.mutation(api.employeeImport.importChunk, { projectId: f.projectId, dryRun: false, rows: [
      row({ department: " iş  güvenliği ", position: "ışık", company: "inci" }),
      row({ rowNumber: 3, email: "existing@example.com", cardNumber: "OTHER" }),
      row({ rowNumber: 4, firstName: "", email: "bad@example.com", cardNumber: "BAD" }),
    ] });
    expect(result.map(item => item.status)).toEqual(["created", "skippedDuplicate", "error"]);
    const state = await f.snapshot();
    expect(state.employees.find(item => item.email === "ada@example.com")).toMatchObject(relations);
    expect(state.scheduled).toEqual([]);
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]).toMatchObject({ userId: f.userId, projectId: f.projectId, action: "create", targetTable: "employees", targetId: String(f.projectId), note: "Excel içe aktarma", newValue: { imported: 1, skipped: 1, errors: 1 }, searchText: expect.any(String) });
    expect(state.audit[0]?.searchText?.length).toBeGreaterThan(0);
    expect(JSON.stringify(state.audit)).not.toContain("ada@example.com");
  });
});

describe("assignCards", () => {
  it("rejects a same-project conflict without changing the employee", async () => {
    const f = await fixture(); const employeeId = await f.employee();
    await f.employee(f.projectId, { email: "second@example.com", cardNumber: "TAKEN" });
    expect(await f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber: "TAKEN" }] })).toMatchObject([{ status: "error" }]);
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.cardNumber).toBe("EXISTING");
  });
  it("rejects inaccessible and orphan employees", async () => {
    const f = await fixture(); const foreign = await f.employee(f.otherProjectId);
    const orphan = await f.employee(f.projectId, { projectId: undefined });
    expect(await f.actor.mutation(api.employeeImport.assignCards, { assignments: [foreign, orphan].map(employeeId => ({ employeeId, cardNumber: "NEW" })) })).toMatchObject([{ status: "error" }, { status: "error" }]);
    expect((await f.snapshot()).employees.every(item => item.cardNumber === "EXISTING")).toBe(true);
  });
  it("rejects project_user", async () => {
    const f = await fixture("project_user"); const employeeId = await f.employee();
    await expect(f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber: "NEW" }] })).rejects.toThrow("yetkiniz yok");
    expect((await f.snapshot()).audit).toEqual([]);
  });
  it("rejects more than 200 assignments before any writes", async () => {
    const f = await fixture(); const employeeId = await f.employee();
    await expect(f.actor.mutation(api.employeeImport.assignCards, { assignments: Array.from({ length: 201 }, () => ({ employeeId, cardNumber: "NEW" })) })).rejects.toThrow("en fazla 200");
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.cardNumber).toBe("EXISTING");
    expect((await f.snapshot()).audit).toEqual([]);
  });
  it("accepts exactly 200 assignments and writes one summary", async () => {
    const f = await fixture();
    const assignments = [];
    for (let i = 0; i < 200; i++) assignments.push({ employeeId: await f.employee(f.projectId, { email: `employee${i}@example.com`, cardNumber: `OLD-${i}` }), cardNumber: `NEW-${i}` });
    const results = await f.actor.mutation(api.employeeImport.assignCards, { assignments });
    expect(results).toHaveLength(200);
    expect(results.every(result => result.status === "assigned")).toBe(true);
    const state = await f.snapshot();
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]?.newValue).toEqual({ assigned: 200, errors: 0 });
  });
  it("finds a conflicting card after 20 other-project matches", async () => {
    const f = await fixture(); const employeeId = await f.employee();
    for (let i = 0; i < 21; i++) await f.employee(f.otherProjectId, { cardNumber: "TAKEN" });
    await f.employee(f.projectId, { cardNumber: "TAKEN" });
    expect(await f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber: "TAKEN" }] })).toMatchObject([{ status: "error" }]);
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.cardNumber).toBe("EXISTING");
  });
  it.each(["", " ", "a b", "a!", "a".repeat(129)])("rejects invalid card format %s", async cardNumber => {
    const f = await fixture(); const employeeId = await f.employee();
    expect(await f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber }] })).toMatchObject([{ status: "error", message: "Kart numarası biçimi geçersiz" }]);
    expect((await f.t.run(ctx => ctx.db.get(employeeId)))?.cardNumber).toBe("EXISTING");
  });
  it("prevents two employees receiving the same card within one call and audits the total", async () => {
    const f = await fixture(); const first = await f.employee();
    const second = await f.employee(f.projectId, { email: "second@example.com", cardNumber: "SECOND" });
    expect(await f.actor.mutation(api.employeeImport.assignCards, { assignments: [first, second].map(employeeId => ({ employeeId, cardNumber: " NEW-123 " })) })).toMatchObject([{ status: "assigned" }, { status: "error" }]);
    const state = await f.snapshot();
    expect(state.audit).toHaveLength(1);
    expect(state.audit[0]).toMatchObject({ action: "update", targetTable: "employees", projectId: f.projectId, newValue: { assigned: 1, errors: 1 } });
    expect(state.audit[0]?.searchText?.length).toBeGreaterThan(0);
    expect(JSON.stringify(state.audit)).not.toContain("NEW-123");
  });
  it("rejects another project's card and allows reassigning the employee's own unique card", async () => {
    const f = await fixture(); const employeeId = await f.employee();
    await f.employee(f.otherProjectId, { cardNumber: "NEW" });
    expect(await f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber: "NEW" }] })).toMatchObject([{ status: "error" }]);
    expect(await f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber: "EXISTING" }] })).toMatchObject([{ status: "assigned" }]);
  });
  it("schedules old-card deletion and two syncs only when the card changes", async () => {
    const f = await fixture(); const employeeId = await f.employee(f.projectId, { cardNumber: "OLD" });
    await f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId, cardNumber: "NEW" }] });
    const changed = await f.snapshot();
    expect(changed.scheduled).toHaveLength(3);
    expect(changed.scheduled[0]?.[2]).toMatchObject({ cardNumber: "OLD" });
    const sameCardId = await f.employee(f.projectId, { email: "same@example.com", cardNumber: "SAME" });
    await f.actor.mutation(api.employeeImport.assignCards, { assignments: [{ employeeId: sameCardId, cardNumber: "SAME" }] });
    expect((await f.snapshot()).scheduled).toHaveLength(3);
  });
});

describe("logExport", () => {
  it("audits row count without person data and checks project access and bounds", async () => {
    const f = await fixture();
    await f.actor.mutation(api.employeeImport.logExport, { projectId: f.projectId, rowCount: 12 });
    const state = await f.snapshot();
    expect(state.audit[0]).toMatchObject({ targetTable: "employees", action: "update", note: "Excel dışa aktarma", newValue: { exported: 12 } });
    await expect(f.actor.mutation(api.employeeImport.logExport, { projectId: f.otherProjectId, rowCount: 1 })).rejects.toThrow("erişim yetkiniz yok");
    await expect(f.actor.mutation(api.employeeImport.logExport, { projectId: f.projectId, rowCount: 5001 })).rejects.toThrow("5000");
  });
});
