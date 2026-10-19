/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { list, summary, acknowledge, getSettings, saveSettings, emailPayload } from "./alarms";

const mocks = vi.hoisted(() => ({ projects: ["p1"], user: { _id: "u1", role: "project_admin" }, events: [] as Array<Record<string, unknown>>, devices: new Map<string, Record<string, unknown>>(), settings: null as Record<string, unknown> | null, audit: vi.fn(async () => undefined) }));
vi.mock("./lib/customFunctions", () => {
  const register = (admin: boolean) => (definition: { handler: unknown }) => ({ _handler: (ctx: { user: { role: string } }, args: unknown) => {
    if (admin && ctx.user.role === "project_user") throw new Error("Bu işlem için yetkiniz yok");
    return (definition.handler as (ctx: unknown, args: unknown) => unknown)(ctx, args);
  } });
  return { authedQuery: register(false), adminQuery: register(true), adminMutation: register(true) };
});
vi.mock("./lib/auth", () => ({ getProjectIdsForUser: async () => mocks.projects, isProjectAllowed: (projects: string[], id: string | undefined) => Boolean(id && projects.includes(id)) }));
vi.mock("./lib/audit", () => ({ writeAudit: mocks.audit }));
vi.mock("convex-helpers/server/stream", () => ({
  stream: () => ({
    query: () => ({
      withIndex: (_name: string, build: (query: { eq: (field: string, value: unknown) => IndexQuery; gte: (field: string, value: unknown) => IndexQuery }) => unknown) => {
        const constraints: Array<[string, string, unknown]> = [];
        const query: IndexQuery = {
          eq(field, value) { constraints.push(["eq", field, value]); return query; },
          gte(field, value) { constraints.push(["gte", field, value]); return query; },
        };
        build(query);
        const rows = mocks.events.filter(row => constraints.every(([operator, field, value]) => operator === "eq" ? row[field] === value : String(row[field]) >= String(value)));
        return {
        order: () => ({
          filterWith: (predicate: (row: Record<string, unknown>) => Promise<boolean>) => ({
            paginate: async (opts: { cursor: string | null; numItems: number }) => {
              const offset = Number(opts.cursor ?? 0);
              const matches: Record<string, unknown>[] = [];
              let scanned = 0;
              let index = offset;
              while (index < rows.length && matches.length < opts.numItems && scanned < 2000) {
                const row = rows[index++];
                scanned++;
                if (await predicate(row)) matches.push(row);
              }
              const done = index >= rows.length;
              return { page: matches, isDone: done, continueCursor: String(index), pageStatus: done ? "Exhausted" : "SplitRequired" };
            },
          }),
        }),
        };
      },
    }),
  }),
}));

type IndexQuery = {
  eq: (field: string, value: unknown) => IndexQuery;
  gte: (field: string, value: unknown) => IndexQuery;
};

function event(id: string, overrides: Record<string, unknown> = {}) {
  return { _id: id, _creationTime: 1, projectId: "p1", deviceId: "d1", source: "hikvision", eventTime: "2026-10-19T10:00:00.000Z", category: "alarm", severity: "warning", label: id, createdAt: "2026-10-19", updatedAt: "2026-10-19", ...overrides };
}
function makeCtx() {
  const records = new Map(mocks.events.map(row => [String(row._id), row]));
  const selectRows = (table: string, constraints: Array<[string, string, unknown]>) => (table === "deviceEvents" ? mocks.events : []).filter(row => constraints.every(([operator, field, value]) => operator === "eq" ? row[field] === value : String(row[field]) >= String(value)));
  const db = {
    get: vi.fn(async (id: string) => records.get(id) ?? mocks.devices.get(id) ?? null),
    patch: vi.fn(async (id: string, changes: Record<string, unknown>) => { const row = records.get(id); if (row) Object.assign(row, changes); }),
    insert: vi.fn(async (_table: string, row: Record<string, unknown>) => { mocks.settings = row; return "settings-id"; }),
    query: vi.fn((table: string) => ({ withIndex: (_name: string, build: (query: IndexQuery) => unknown) => {
      const constraints: Array<[string, string, unknown]> = [];
      const query: IndexQuery = { eq(field, value) { constraints.push(["eq", field, value]); return query; }, gte(field, value) { constraints.push(["gte", field, value]); return query; } };
      build(query);
      const rows = selectRows(table, constraints);
      return { order: () => ({ take: async (limit: number) => rows.slice(0, limit) }), unique: async () => table === "alarmSettings" ? mocks.settings : null, take: async (limit: number) => rows.slice(0, limit) };
    } })),
  };
  return { db, user: { ...mocks.user, _id: "u1" } };
}
function handler<T>(fn: unknown): T { return (fn as { _handler: T })._handler; }
const projectId = "p1" as Id<"projects">;
const baseArgs = { projectId, category: "alarm" as const, status: "open" as const, paginationOpts: { numItems: 2, cursor: null } };

beforeEach(() => { mocks.projects = ["p1"]; mocks.user = { _id: "u1", role: "project_admin" }; mocks.events = []; mocks.devices.clear(); mocks.settings = null; mocks.audit.mockClear(); });

describe("alarm handlers", () => {
  it("lists only authorized projects", async () => {
    const fn = handler<(ctx: QueryCtx, args: FunctionArgs<typeof api.alarms.list>) => Promise<FunctionReturnType<typeof api.alarms.list>>>(list);
    await expect(fn(makeCtx() as unknown as QueryCtx, { ...baseArgs, projectId: "p2" as Id<"projects"> })).rejects.toThrow("erişim");
  });
  it("applies status and severity before pagination and advances through sparse matches", async () => {
    mocks.events = [event("a"), event("b", { severity: "critical", ackedAt: "now" }), event("c"), event("d", { severity: "critical" }), event("e", { ackedAt: "now" }), event("other-project", { projectId: "p2", severity: "critical" })];
    const fn = handler<(ctx: QueryCtx, args: FunctionArgs<typeof api.alarms.list>) => Promise<FunctionReturnType<typeof api.alarms.list>>>(list);
    const ctx = makeCtx() as unknown as QueryCtx;
    const first = await fn(ctx, { ...baseArgs, severity: "critical", status: "open" });
    expect(first.page.map(row => row._id)).toEqual(["d"]);
    expect(first.isDone).toBe(true);
    const all = await fn(ctx, { ...baseArgs, status: "acked", paginationOpts: { numItems: 1, cursor: null } });
    expect(all.page.map(row => row._id)).toEqual(["b"]);
  });
  it("rejects project_user acknowledgement, cross-project ids and oversized batches; duplicate ack is idempotent", async () => {
    mocks.events = [event("e1"), event("e2", { projectId: "p2" })];
    const fn = handler<(ctx: MutationCtx, args: FunctionArgs<typeof api.alarms.acknowledge>) => Promise<FunctionReturnType<typeof api.alarms.acknowledge>>>(acknowledge);
    const ctx = makeCtx() as unknown as MutationCtx & { user: { role: string } };
    ctx.user.role = "project_user";
    await expect(Promise.resolve().then(() => fn(ctx, { ids: ["e1" as Id<"deviceEvents">] }))).rejects.toThrow("yetkiniz");
    ctx.user.role = "project_admin";
    await expect(fn(ctx, { ids: ["e2" as Id<"deviceEvents">] })).rejects.toThrow("erişim");
    await expect(Promise.resolve().then(() => fn(ctx, { ids: Array.from({ length: 51 }, (_, i) => `e${i}` as Id<"deviceEvents">) }))).rejects.toThrow("50");
    await expect(fn(ctx, { ids: ["e1" as Id<"deviceEvents">, "e1" as Id<"deviceEvents">] })).resolves.toEqual({ acknowledged: 1 });
    await expect(fn(ctx, { ids: ["e1" as Id<"deviceEvents">] })).resolves.toEqual({ acknowledged: 0 });
    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
    mocks.events = [event("operation", { category: "operation" })];
    await expect(fn(makeCtx() as unknown as MutationCtx, { ids: ["operation" as Id<"deviceEvents">] })).rejects.toThrow("Yalnızca alarm");
  });
  it("validates, deduplicates and caps settings recipients", async () => {
    const fn = handler<(ctx: MutationCtx, args: FunctionArgs<typeof api.alarms.saveSettings>) => Promise<FunctionReturnType<typeof api.alarms.saveSettings>>>(saveSettings);
    const ctx = makeCtx() as unknown as MutationCtx & { user: { role: string } };
    await expect(fn(ctx, { projectId, emailEnabled: true, recipients: ["bad"], minSeverity: "warning" })).rejects.toThrow("e-posta");
    await expect(fn(ctx, { projectId, emailEnabled: true, recipients: Array.from({ length: 9 }, (_, i) => `${i}@example.com`), minSeverity: "warning" })).rejects.toThrow("8");
    await fn(ctx, { projectId, emailEnabled: true, recipients: [" A@Example.com ", "a@example.com", ""], minSeverity: "warning" });
    expect(mocks.settings?.recipients).toEqual(["a@example.com"]);
  });
  it("returns default settings and a bounded email payload", async () => {
    const settingsFn = handler<(ctx: QueryCtx, args: FunctionArgs<typeof api.alarms.getSettings>) => Promise<FunctionReturnType<typeof api.alarms.getSettings>>>(getSettings);
    expect(await settingsFn(makeCtx() as unknown as QueryCtx, { projectId })).toMatchObject({ emailEnabled: false, recipients: [], minSeverity: "warning" });
    mocks.events = [event("email", { severity: "critical", eventTime: new Date().toISOString() }), event("recent", { label: "email", eventTime: new Date().toISOString(), alarmNotifiedAt: new Date().toISOString() })];
    mocks.settings = { projectId, emailEnabled: true, recipients: ["ops@example.com"], minSeverity: "warning" };
    mocks.devices.set("d1", { _id: "d1", name: "Kapı" });
    const payloadFn = handler<(ctx: QueryCtx, args: FunctionArgs<typeof internal.alarms.emailPayload>) => Promise<FunctionReturnType<typeof internal.alarms.emailPayload>>>(emailPayload);
    await expect(payloadFn(makeCtx() as unknown as QueryCtx, { eventId: "email" as Id<"deviceEvents"> })).resolves.toMatchObject({ recipients: ["ops@example.com"], device: { name: "Kapı" }, sentRecently: true });
  });
  it("summarizes only the authorized project and audits settings without recipient addresses", async () => {
    mocks.events = [event("a", { severity: "critical" }), event("b", { projectId: "p2", severity: "critical" })];
    const summaryFn = handler<(ctx: QueryCtx, args: FunctionArgs<typeof api.alarms.summary>) => Promise<FunctionReturnType<typeof api.alarms.summary>>>(summary);
    const ctx = makeCtx() as unknown as QueryCtx;
    await expect(summaryFn(ctx, { projectId })).resolves.toMatchObject({ critical: 1, warning: 0 });
    await expect(summaryFn(ctx, { projectId: "p2" as Id<"projects"> })).rejects.toThrow("erişim");
    const saveFn = handler<(ctx: MutationCtx, args: FunctionArgs<typeof api.alarms.saveSettings>) => Promise<FunctionReturnType<typeof api.alarms.saveSettings>>>(saveSettings);
    await saveFn(makeCtx() as unknown as MutationCtx, { projectId, emailEnabled: true, recipients: ["private@example.com"], minSeverity: "warning" });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ targetTable: "alarmSettings", newValue: { emailEnabled: true, minSeverity: "warning", recipientCount: 1 } }));
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("private@example.com");
  });
});
