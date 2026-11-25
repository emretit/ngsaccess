import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { backfillHikEventRow, listFiltered } from "./cardReadings";

type Row = Record<string, unknown>;
type Constraint = [string, string, unknown];
type Builder = { eq: (field: string, value: unknown) => Builder; gte: (field: string, value: unknown) => Builder; lte: (field: string, value: unknown) => Builder; search: (field: string, value: unknown) => Builder };
const state = vi.hoisted(() => ({ rows: [] as Row[], records: new Map<string, Row>(), readers: [] as Row[], indices: [] as string[], queries: [] as string[], limits: [] as number[], pagination: vi.fn(), scope: vi.fn(async () => ["p"]) }));
vi.mock("./lib/customFunctions", () => {
  const passThrough = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return { authedQuery: passThrough, authedMutation: passThrough, employeeAuthedQuery: passThrough, employeeAuthedMutation: passThrough };
});
vi.mock("./lib/readingAccess", async importOriginal => ({ ...await importOriginal<typeof import("./lib/readingAccess")>(), resolveReadingScope: state.scope }));

function constrain(build: (q: Builder) => unknown) {
  const constraints: Constraint[] = [];
  const q: Builder = {
    eq(field, value) { constraints.push(["eq", field, value]); return q; },
    gte(field, value) { constraints.push(["gte", field, value]); return q; },
    lte(field, value) { constraints.push(["lte", field, value]); return q; },
    search(field, value) { constraints.push(["search", field, value]); return q; },
  };
  build(q);
  return (row: Row) => constraints.every(([op, field, value]) => op === "eq" ? row[field] === value : op === "search" ? String(row[field]).startsWith(String(value)) : op === "gte" ? String(row[field]) >= String(value) : String(row[field]) <= String(value));
}
function ordered(rows: Row[]) {
  return { filterWith: (predicate: (row: Row) => Promise<boolean>) => ({ paginate: async (opts: { numItems: number; cursor: string | null; maximumRowsRead: number }) => {
    state.pagination(opts);
    let offset = Number(opts.cursor ?? 0);
    const page: Row[] = [];
    let scanned = 0;
    while (offset < rows.length && page.length < opts.numItems && scanned < opts.maximumRowsRead) {
      const row = rows[offset++];
      scanned++;
      if (await predicate(row)) page.push(row);
    }
    return { page, isDone: offset >= rows.length, continueCursor: String(offset), pageStatus: offset < rows.length && scanned === opts.maximumRowsRead ? "SplitRequired" : null };
  } }) };
}
vi.mock("convex-helpers/server/stream", () => ({
  stream: () => ({ query: () => ({ withIndex: (name: string, build: (q: Builder) => unknown) => {
    state.indices.push(name);
    const rows = state.rows.filter(constrain(build)).sort((a, b) => String(b.accessTime).localeCompare(String(a.accessTime)));
    return { order: () => ({ ...ordered(rows), testRows: rows }) };
  } }) }),
  mergedStream: (streams: { testRows: Row[] }[]) => ordered([...new Map(streams.flatMap(s => s.testRows).map(row => [row._id, row])).values()].sort((a, b) => String(b.accessTime).localeCompare(String(a.accessTime)))),
}));

const projectId = "p" as Id<"projects">;
const doorId = "door" as Id<"doors">;
const base = { projectId, doorId, paginationOpts: { numItems: 10, cursor: null } };
const run = (listFiltered as unknown as { _handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.cardReadings.listFiltered>) => Promise<FunctionReturnType<typeof api.cardReadings.listFiltered>> })._handler;
function context() {
  return { db: {
    get: vi.fn(async (id: string) => state.records.get(id) ?? null),
    query: (table: string) => {
      state.queries.push(table);
      const select = (name: string, build: (q: Builder) => unknown) => {
        state.indices.push(`${table}.${name}`);
        const rows = (table === "readers" ? state.readers : [...state.records.values()].filter(row => row.table === table)).filter(constrain(build));
        return { take: async (limit: number) => { state.limits.push(limit); return rows.slice(0, limit); }, collect: async () => rows };
      };
      return { withIndex: select, withSearchIndex: select };
    },
  } } as unknown as QueryCtx;
}
function reading(id: string, readerNo?: number, overrides: Row = {}) {
  return { _id: id, _creationTime: 1, projectId, deviceId: "device", cardNo: "42", accessTime: "2026-11-25T09:00:00.000Z", hikCardReaderNo: readerNo, accessStatus: "izin_verildi", ...overrides };
}
function door(overrides: Row = {}) {
  state.records.set(doorId, { _id: doorId, table: "doors", projectId, deviceId: "device", name: "Hik kapı", hikDoorNo: 2, ...overrides });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.rows = []; state.readers = []; state.records.clear(); state.indices = []; state.queries = []; state.limits = [];
  state.scope.mockResolvedValue(["p"]);
  state.records.set("device", { _id: "device", projectId, name: "Hik", brand: "hikvision" });
  door();
});

describe("Hik door history filter", () => {
  it("uses actual custom reader mappings for both sides, with one bounded lookup and no enrichment queries", async () => {
    state.readers = [7, 8].map(hikReaderNo => ({ doorId, projectId, deviceId: "device", hikReaderNo }));
    state.rows = [reading("entry", 7), reading("exit", 8), reading("other-door", 3), reading("missing"), reading("ide", 7, { ideIoId: 0 }), reading("foreign", 7, { projectId: "foreign" }), reading("other-device", 7, { deviceId: "other" })];
    const result = await run(context(), base);
    expect(result.page.map(r => r._id)).toEqual(["entry", "exit"]);
    expect(result.page[0]?.door).toMatchObject({ _id: doorId, name: "Hik kapı" });
    expect(state.queries).toEqual(["readers"]);
    expect(state.limits).toEqual([101]);
    expect(state.indices).toContain("by_project_device_time");
  });
  it("falls back to both conventional reader numbers only when there are no reader records", async () => {
    state.rows = [reading("entry", 3), reading("exit", 4), reading("other", 1)];
    expect((await run(context(), base)).page.map(r => r._id)).toEqual(["entry", "exit"]);
  });
  it("uses legacy door 1 default when the door number is absent", async () => {
    door({ hikDoorNo: undefined });
    state.rows = [reading("entry", 1), reading("exit", 2), reading("other", 3)];
    expect((await run(context(), base)).page.map(r => r._id)).toEqual(["entry", "exit"]);
  });
  it("does not guess mappings for foreign or invalid reader records", async () => {
    state.readers = [{ doorId, projectId: "foreign", hikReaderNo: 3 }, { doorId, projectId, deviceId: "other", hikReaderNo: 4 }, { doorId, projectId, hikReaderNo: -1 }];
    state.rows = [reading("entry", 3), reading("exit", 4)];
    expect((await run(context(), base)).page).toEqual([]);
  });
  it.each(["entry", "exit", "both"] as const)("derives legacy unnumbered %s readers", async direction => {
    state.readers = [{ doorId, projectId, deviceId: "device", direction }];
    state.rows = [reading("entry", 3), reading("exit", 4), reading("other", 1)];
    expect((await run(context(), base)).page.map(r => r._id)).toEqual(direction === "both" ? ["entry", "exit"] : [direction]);
  });
  it("fails explicitly when the bounded lookup reaches 101 readers", async () => {
    state.readers = Array.from({ length: 101 }, () => ({ doorId, projectId, hikReaderNo: 3 }));
    await expect(run(context(), base)).rejects.toThrow("100'den fazla");
    expect(state.pagination).not.toHaveBeenCalled();
  });
  it("preserves IDE IO zero, its index and its enrichment without a readers lookup", async () => {
    door({ ioId: 0 });
    state.records.set("device", { _id: "device", projectId, brand: "ide_smart" });
    state.rows = [reading("ide", undefined, { ideIoId: 0 }), reading("other", undefined, { ideIoId: 1 }), reading("hik", 3)];
    const result = await run(context(), base);
    expect(result.page.map(r => r._id)).toEqual(["ide"]);
    expect(result.page[0]?.door?._id).toBe(doorId);
    expect(state.indices).toContain("by_device_io_time");
    expect(state.queries).toEqual(["doors"]);
  });
  it.each([{ projectId: "foreign" }, { deviceId: undefined }])("rejects invalid door scope: %s", async overrides => {
    door(overrides);
    await expect(run(context(), base)).rejects.toThrow("eşleşmiyor");
  });
  it("rejects a conflicting selected device before looking up readers", async () => {
    await expect(run(context(), { ...base, deviceId: "other" as Id<"devices"> })).rejects.toThrow("bu cihaza bağlı değil");
    expect(state.queries).toEqual([]);
  });
  it("preserves project authorization", async () => {
    state.scope.mockRejectedValueOnce(new Error("Erişim yok"));
    await expect(run(context(), base)).rejects.toThrow("Erişim yok");
    expect(state.queries).toEqual([]);
  });
  it("combines employee, date, source, result and card search with door matching", async () => {
    state.records.set("employee", { _id: "employee", projectId });
    state.rows = [reading("match", 3, { employeeId: "employee" }), reading("other-door", 1, { employeeId: "employee" }), reading("other-result", 3, { employeeId: "employee", accessStatus: "reddedildi" }), reading("other-person", 3), reading("other-day", 3, { employeeId: "employee", accessTime: "2026-11-24T09:00:00.000Z" })];
    const result = await run(context(), { ...base, employeeId: "employee" as Id<"employees">, startDate: "2026-11-25", endDate: "2026-11-25", source: "card", result: "granted", search: "42" });
    expect(result.page.map(r => r._id)).toEqual(["match"]);
    expect(state.indices).toContain("by_project_card_time");
  });
  it("advances sparse pages and retains the existing scan/byte/page budgets", async () => {
    state.rows = Array.from({ length: 2002 }, (_, i) => reading(String(i), i >= 2000 ? 3 : 1));
    const first = await run(context(), { ...base, paginationOpts: { numItems: 999, cursor: null } });
    expect(first.page).toEqual([]);
    expect(first.scannedCount).toBe(2000);
    expect(first.scanLimitReached).toBe(true);
    expect(state.pagination).toHaveBeenCalledWith({ cursor: null, numItems: 200, maximumRowsRead: 2000, maximumBytesRead: 2_000_000 });
    const next = await run(context(), { ...base, paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect(next.page.map(r => r._id)).toEqual(["2000"]);
    expect(next.isDone).toBe(false);
    expect((await run(context(), { ...base, paginationOpts: { numItems: 1, cursor: next.continueCursor } })).page.map(r => r._id)).toEqual(["2001"]);
  });
  it("uses only the batch device mapping without a selected door", async () => {
    state.rows = [reading("reading", 3)];
    const result = await run(context(), { projectId, paginationOpts: base.paginationOpts });
    expect(state.queries).toEqual(["doors", "readers"]);
    expect(state.indices).not.toContain("readers.by_door");
    expect(result.page[0]?.door?._id).toBe(doorId);
  });
  it("keeps selective device/status and device/employee indices for Hik doors", async () => {
    state.rows = [reading("match", 3, { employeeId: "employee" }), reading("denied", 3, { accessStatus: "reddedildi" })];
    expect((await run(context(), { ...base, result: "granted" })).page.map(r => r._id)).toEqual(["match"]);
    expect(state.indices).toContain("by_project_device_status_time");
    state.records.set("employee", { _id: "employee", projectId });
    expect((await run(context(), { ...base, employeeId: "employee" as Id<"employees"> })).page.map(r => r._id)).toEqual(["match"]);
    expect(state.indices).toContain("by_project_device_employee_time");
  });
  it("accepts 100 readers and rejects an unbound non-Hik door", async () => {
    state.readers = Array.from({ length: 100 }, () => ({ doorId, projectId, hikReaderNo: 3 }));
    state.rows = [reading("match", 3)];
    expect((await run(context(), base)).page).toHaveLength(1);
    state.records.set("device", { _id: "device", projectId, brand: "ide_smart" });
    await expect(run(context(), base)).rejects.toThrow("eşleşmiyor");
  });
});

describe("anonymous Hik backfill", () => {
  it.each(["", "   "])("never links an empty card event (%j) to a cardless person", async cardNo => {
    const employeeQuery = vi.fn();
    const insert = vi.fn(async () => "inserted");
    const db = {
      get: async () => ({ _id: "device", projectId }),
      query: (table: string) => ({ withIndex: () => ({
        first: async () => null,
        take: async () => { employeeQuery(table); return [{ _id: "cardless-a", projectId, cardNumber: "", firstName: "A", lastName: "Kişi" }, { _id: "cardless-b", projectId, cardNumber: "", firstName: "B", lastName: "Kişi" }]; },
      }) }),
      insert,
    };
    const handler = (backfillHikEventRow as unknown as { _handler: (ctx: MutationCtx, args: { deviceId: Id<"devices">; event: { time: string; cardNo: string; major: number; minor: number; serialNo: number } }) => Promise<unknown> })._handler;
    await expect(handler({ db } as unknown as MutationCtx, { deviceId: "device" as Id<"devices">, event: { time: "2026-11-25T09:00:00+03:00", cardNo, major: 5, minor: 3, serialNo: 1 } })).resolves.toEqual({ inserted: true });
    expect(employeeQuery).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith("cardReadings", expect.objectContaining({ cardNo: "", employeeId: undefined, employeeName: undefined }));
  });
});
