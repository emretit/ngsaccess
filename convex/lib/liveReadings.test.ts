import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assignCardFromReading, getReading, listFiltered, listLiveSince, searchMonitoringPeople, lastMonitoringReading } from "../cardReadings";
import { update as updateEmployee } from "../employees";
import { getCurrentUser } from "./auth";
import { assignmentPrecondition, isPhysicalCardNumber, liveReadingSource, liveReadingWindow, matchesReadingResult, mergeLiveReadings } from "./liveReadings";

// Keep both real authentication wrappers, including the nested employees.update role check.
// Only authentication identity/project lookup and the DB/scheduler transport are substituted.
vi.mock("./auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("./auth")>(),
  getCurrentUser: vi.fn(async (ctx: { user: Doc<"users"> }) => ctx.user),
  getProjectIdsForUser: vi.fn(async () => ["project"]),
}));
const projectId = "project" as Id<"projects">;
const employeeId = "employee" as Id<"employees">;
const readingId = "reading" as Id<"cardReadings">;
const deviceId = "device" as Id<"devices">;
const doorId = "door" as Id<"doors">;
const reading = (overrides: Partial<Doc<"cardReadings">> = {}): Doc<"cardReadings"> => ({
  _id: readingId, _creationTime: 100, projectId, cardNo: "001234", accessTime: "2026-10-17T08:00:00.000Z", ...overrides,
});
const precondition = { reading: reading(), employeeProjectId: projectId, currentCard: "old", expectedCurrentCard: "old", duplicate: false };

beforeEach(() => vi.clearAllMocks());

describe("shared source classification and assignment prerequisites", () => {
  it.each([
    ["cardOrFace", "card"], ["cardAndFace", "biometric"], ["face", "biometric"],
  ] as const)("%s obeys shared Hik evidence precedence", (mode, expected) => {
    expect(liveReadingSource(reading({ hikCurrentVerifyMode: mode, hikMajorEventType: 5, hikSubEventType: 1 }))).toBe(expected);
  });
  it.each(["pin", "manual"])("%s folds to unknown, never assignable", source => {
    const row = reading({ rawData: JSON.stringify({ source }) });
    expect(liveReadingSource(row)).toBe("unknown");
    expect(assignmentPrecondition({ ...precondition, reading: row })).toBe("INVALID_CARD_SOURCE");
  });
  it.each(["qr", "mobile", "mobile_qr"])("%s rejects employee-card substitution", source => {
    expect(assignmentPrecondition({ ...precondition, reading: reading({ rawData: JSON.stringify({ source }) }) })).toBe("INVALID_CARD_SOURCE");
  });
  it("rejects UUID credentials and mixed biometric events even when a card is present", () => {
    expect(assignmentPrecondition({ ...precondition, reading: reading({ cardNo: "123e4567-e89b-12d3-a456-426614174000" }) })).toBe("INVALID_CARD_SOURCE");
    expect(assignmentPrecondition({ ...precondition, reading: reading({ hikCurrentVerifyMode: "cardAndFace" }) })).toBe("INVALID_CARD_SOURCE");
  });
  it.each(["", " ", "0", "0000", "123 456", "https://qr/token", "IADE:123:x", "unknown", "a".repeat(33)])("rejects nonphysical credential %s", cardNo => {
    expect(isPhysicalCardNumber(cardNo)).toBe(false);
  });
  it("preserves leading zeroes and rejects stale state, duplicates and cross-project assignment", () => {
    expect(assignmentPrecondition(precondition)).toBeNull();
    expect(precondition.reading.cardNo).toBe("001234");
    expect(assignmentPrecondition({ ...precondition, currentCard: "new" })).toBe("CARD_CHANGED");
    expect(assignmentPrecondition({ ...precondition, duplicate: true })).toBe("DUPLICATE_CARD");
    expect(assignmentPrecondition({ ...precondition, employeeProjectId: "other" })).toBe("PROJECT_MISMATCH");
    expect(assignmentPrecondition({ ...precondition, reading: reading({ employeeId }) })).toBe("READING_ALREADY_ASSIGNED");
    expect(assignmentPrecondition({ ...precondition, currentCard: "", expectedCurrentCard: null })).toBe("CARD_CHANGED");
  });
});

describe("bounded intake watermark", () => {
  it("merges by identity and receipt time, retaining updated rows and a bounded buffer", () => {
    const old = reading({ _creationTime: 200 });
    const late = reading({ _id: "late" as Id<"cardReadings">, _creationTime: 300, accessTime: "2020-01-01T00:00:00Z" });
    expect(mergeLiveReadings([old], [late, { ...old, employeeName: "Updated" }], 2)).toEqual([late, { ...old, employeeName: "Updated" }]);
    expect(mergeLiveReadings([old], [late], 1)).toEqual([late]);
  });
  it("hasMore detects overflow including tied timestamps; strict watermark omits already-seen rows", () => {
    const rows = [reading(), reading({ _id: "b" as Id<"cardReadings"> }), reading({ _id: "c" as Id<"cardReadings">, _creationTime: 200 })];
    expect(liveReadingWindow(rows, 2)).toMatchObject({ latestCreationTime: 200, hasMore: true });
    expect(liveReadingWindow(rows, 2, 100)).toMatchObject({ rows: [rows[2]], latestCreationTime: 200, hasMore: false });
    expect(liveReadingWindow([], 2, 200)).toEqual({ rows: [], latestCreationTime: 200, hasMore: false });
    expect(liveReadingWindow([], 2)).toEqual({ rows: [], latestCreationTime: null, hasMore: false });
  });
  it("maps unknown separately from denied", () => {
    expect(matchesReadingResult(undefined, "unknown")).toBe(true);
    expect(matchesReadingResult(undefined, "denied")).toBe(false);
    expect(matchesReadingResult("reddedildi", "denied")).toBe(true);
    expect(matchesReadingResult("izin_verildi", "granted")).toBe(true);
  });
});

type Row = Record<string, unknown>;
function context(rows: Doc<"cardReadings">[] = [reading()]) {
  const employee: Row = { _id: employeeId, _creationTime: 1, projectId, firstName: "Ada", lastName: "Test", cardNumber: "old", email: "a@example.test", isActive: true };
  const user = { _id: "admin", role: "project_admin" };
  const tables: Record<string, Row[]> = {
    userProjects: [{ _id: "membership", userId: "admin", projectId }],
    cardReadings: rows, employees: [employee], auditLog: [],
    devices: [{ _id: deviceId, projectId, name: "Panel", deviceSerial: "SERIAL" }],
    doors: [{ _id: doorId, projectId, deviceId, ioId: 0, name: "Kapı" }],
  };
  const indexes: string[] = [];
  const query = (table: string) => {
    let selected = [...(tables[table] ?? [])];
    let sortField = "_creationTime";
    const index = {
      search: (field: string, value: string) => { selected = selected.filter(row => String(row[field]).toLowerCase().includes(value.toLowerCase())); return index; },
      eq: (field: string, value: unknown) => { selected = selected.filter(row => row[field] === value); return index; },
      gt: (field: string, value: string | number) => { selected = selected.filter(row => { const v = row[field]; return (typeof v === "number" || typeof v === "string") && v > value; }); return index; },
      lt: (field: string, value: string | number) => { selected = selected.filter(row => { const v = row[field]; return (typeof v === "number" || typeof v === "string") && v < value; }); return index; },
      gte: (field: string, value: string | number) => { selected = selected.filter(row => { const v = row[field]; return (typeof v === "number" || typeof v === "string") && v >= value; }); return index; },
      lte: (field: string, value: string | number) => { selected = selected.filter(row => { const v = row[field]; return (typeof v === "number" || typeof v === "string") && v <= value; }); return index; },
    };
    const chain = {
      withIndex: (name: string, apply: (q: typeof index) => unknown) => { indexes.push(name); sortField = name.endsWith("_time") ? "accessTime" : "_creationTime"; apply(index); return chain; },
      order: (direction: string) => { selected.sort((a, b) => (String(a[sortField]).localeCompare(String(b[sortField]), undefined, { numeric: true }) || Number(a._creationTime) - Number(b._creationTime) || String(a._id).localeCompare(String(b._id))) * (direction === "desc" ? -1 : 1)); return chain; },
      withSearchIndex: (name: string, apply: (q: typeof index) => unknown) => { indexes.push(name); apply(index); return chain; },
      [Symbol.asyncIterator]: async function* () { yield* selected; },
      collect: async () => selected,
      unique: async () => selected[0] ?? null,
      first: async () => selected[0] ?? null,
      take: async (n: number) => selected.slice(0, n),
      paginate: async (opts: { numItems: number; cursor: string | null; maximumRowsRead?: number }) => {
        const offset = Number(opts.cursor ?? 0);
        const count = Math.min(opts.numItems, opts.maximumRowsRead ?? Infinity);
        return { page: selected.slice(offset, offset + count), isDone: offset + count >= selected.length, continueCursor: String(offset + count) };
      },
    };
    return chain;
  };
  const patch = vi.fn(async (id: string, updates: Row) => {
    const record = Object.values(tables).flat().find(row => row._id === id);
    if (record) Object.assign(record, updates);
  });
  const runAfter = vi.fn(async () => "scheduled");
  const db = {
    query, patch,
    normalizeId: (_table: string, id: string) => id === "invalid" ? null : id,
    get: async (id: string) => structuredClone(Object.values(tables).flat().find(row => row._id === id) ?? null),
    insert: vi.fn(async (table: string, row: Row) => { tables[table] = [...(tables[table] ?? []), row]; return "inserted"; }),
  };
  const ctx = { user, db, scheduler: { runAfter }, runMutation: vi.fn() };
  ctx.runMutation.mockImplementation(async (ref: Parameters<typeof getFunctionName>[0], args: object) => {
    expect(getFunctionName(ref)).toBe("employees:update");
    return invoke(updateEmployee, ctx, args);
  });
  return { ctx, tables, employee, patch, runAfter, indexes };
}
async function invoke<T = unknown>(fn: unknown, ctx: unknown, args: object): Promise<T> {
  return (fn as { _handler: (ctx: MutationCtx | QueryCtx, args: object) => Promise<T> })._handler(ctx as MutationCtx, args);
}

describe("public handlers through real auth wrappers", () => {
  it("assigns via employees.update, schedules both syncs, audits, and preserves the reading snapshot", async () => {
    const row = reading();
    const f = context([row]);
    expect(await invoke(assignCardFromReading, f.ctx, { readingId, employeeId, expectedCurrentCard: "old" })).toEqual({ employeeId, cardNumber: "001234", syncStatus: "noTargets" });
    expect(f.ctx.runMutation).toHaveBeenCalledOnce();
    expect(getCurrentUser).toHaveBeenCalledTimes(2);
    expect(f.employee.cardNumber).toBe("001234");
    expect(f.patch).toHaveBeenCalledWith(employeeId, expect.objectContaining({ cardNumber: "001234" }));
    expect(f.runAfter).toHaveBeenCalledTimes(2);
    expect(f.tables.auditLog[0]).toMatchObject({ targetTable: "employees", oldValue: { cardNumber: "old" }, newValue: { cardNumber: "001234", readingId } });
    expect(row).toEqual(reading());
  });
  it("both outer and nested permission checks reject members", async () => {
    const f = context();
    f.ctx.user.role = "member";
    await expect(invoke(assignCardFromReading, f.ctx, { readingId, employeeId, expectedCurrentCard: "old" })).rejects.toThrow("Bu işlem için yetkiniz yok");
    await expect(invoke(updateEmployee, f.ctx, { employeeId, cardNumber: "001234" })).rejects.toThrow("Bu işlem için yetkiniz yok");
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.ctx.runMutation).not.toHaveBeenCalled();
  });
  it("an already-current card does not claim a new device sync", async () => {
    const f = context();
    f.employee.cardNumber = "001234";
    expect(await invoke(assignCardFromReading, f.ctx, { readingId, employeeId, expectedCurrentCard: "001234" })).toMatchObject({ syncStatus: "notRequested" });
    expect(f.runAfter).not.toHaveBeenCalled();
  });
  it("the reused update path removes the old IDE card before scheduling the new credential", async () => {
    const f = context();
    f.tables.devices[0] = { ...f.tables.devices[0], brand: "ide_smart", isActive: true };
    f.tables.accessRules = [{ _id: "rule", projectId, isActive: true }];
    f.tables.groupMembers = [{ projectId, employeeId, groupId: "rule" }];
    f.tables.groupDevices = [{ projectId, groupId: "rule", deviceId }];
    expect(await invoke(assignCardFromReading, f.ctx, { readingId, employeeId, expectedCurrentCard: "old" })).toMatchObject({ syncStatus: "pending" });
    expect(f.runAfter).toHaveBeenNthCalledWith(1, 0, expect.anything(), { cardNumber: "old", deviceIds: [deviceId], projectId });
    expect(f.runAfter).toHaveBeenCalledTimes(3);
  });
  it.each(["stale", "duplicate", "foreign", "biometric", "matched", "missing"])("%s fails before any write or sync", async kind => {
    const f = context();
    let expectedCurrentCard = "old";
    if (kind === "stale") expectedCurrentCard = "outdated";
    if (kind === "duplicate") f.tables.employees.push({ ...f.employee, _id: "another", cardNumber: "001234" });
    if (kind === "foreign") f.employee.projectId = "foreign";
    if (kind === "biometric") f.tables.cardReadings[0].hikCurrentVerifyMode = "face";
    if (kind === "matched") f.tables.cardReadings[0].employeeId = employeeId;
    if (kind === "missing") f.tables.cardReadings = [];
    await expect(invoke(assignCardFromReading, f.ctx, { readingId, employeeId, expectedCurrentCard })).rejects.toBeInstanceOf(ConvexError);
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.ctx.runMutation).not.toHaveBeenCalled();
    expect(f.runAfter).not.toHaveBeenCalled();
    expect(f.tables.auditLog).toHaveLength(0);
  });
  it("inner update preserves its project authorization check", async () => {
    const f = context();
    f.employee.projectId = "foreign";
    await expect(invoke(updateEmployee, f.ctx, { employeeId, cardNumber: "001234" })).rejects.toThrow("Bu çalışana erişim yetkiniz yok");
    expect(f.patch).not.toHaveBeenCalled();
  });
  it("detail enriches source and door ID and returns null for unavailable or foreign readings", async () => {
    const f = context([reading({ deviceId, ideIoId: 0 })]);
    expect(await invoke(getReading, f.ctx, { readingId })).toMatchObject({ source: "card", door: { _id: doorId }, devices: { name: "Panel" } });
    f.tables.cardReadings[0].projectId = "foreign";
    expect(await invoke(getReading, f.ctx, { readingId })).toBeNull();
    f.tables.cardReadings = [];
    expect(await invoke(getReading, f.ctx, { readingId })).toBeNull();
  });
  it("live catch-up includes late event-time delivery using the project creation index", async () => {
    const f = context([reading({ _creationTime: 200, accessTime: "2020-01-01T00:00:00Z" }), reading({ _id: "older" as Id<"cardReadings">, _creationTime: 100 })]);
    expect(await invoke(listLiveSince, f.ctx, { projectId, afterCreationTime: 150, limit: 1 })).toMatchObject({ latestCreationTime: 200, hasMore: false, rows: [{ _id: readingId }] });
    expect(f.indexes).toContain("by_project");
  });
  it("initial live snapshot uses TR intake-day boundary and bounds overflow", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-17T01:00:00Z"));
      const start = Date.parse("2026-10-16T21:00:00Z");
      const f = context([reading({ _creationTime: start - 1 }), reading({ _id: "today" as Id<"cardReadings">, _creationTime: start }), reading({ _id: "new" as Id<"cardReadings">, _creationTime: start + 1 })]);
      expect(await invoke(listLiveSince, f.ctx, { projectId, limit: 1 })).toMatchObject({ rows: [{ _id: "new" }], latestCreationTime: start + 1, hasMore: true });
    } finally { vi.useRealTimers(); }
  });
  it("door candidates exclude foreign rows; empty filtered page keeps cursor and scan count", async () => {
    const f = context([
      reading({ deviceId, ideIoId: 0, accessStatus: "reddedildi" }),
      reading({ _id: "unknown" as Id<"cardReadings">, deviceId, ideIoId: 0, employeeId, accessTime: "2026-10-17T07:00:00Z" }),
      reading({ _id: "foreign" as Id<"cardReadings">, projectId: "foreign" as Id<"projects">, deviceId, ideIoId: 0, employeeId, accessTime: "2026-10-17T06:00:00Z" }),
    ]);
    const args = { projectId, doorId, employeeId, result: "unknown", paginationOpts: { numItems: 1, cursor: null } };
    const first = await invoke<{ continueCursor: string }>(listFiltered, f.ctx, args);
    expect(first).toMatchObject({ page: [{ _id: "unknown", source: "card" }], scannedCount: 2, matchedCount: 1, filterScope: "boundedScan" });
    expect(await invoke(listFiltered, f.ctx, { ...args, paginationOpts: { numItems: 1, cursor: first.continueCursor } })).toMatchObject({ page: [], isDone: true });
    expect(f.indexes).toContain("by_device_io_time");
  });
  it("server search merges exact card and person-name matches in access-time order across pages", async () => {
    const f = context([
      reading({ _id: "card" as Id<"cardReadings">, cardNo: "777", accessTime: "2026-10-17T09:00:00.000Z" }),
      reading({ _id: "person" as Id<"cardReadings">, cardNo: "555", employeeId, accessTime: "2026-10-17T08:00:00.000Z" }),
      reading({ _id: "other" as Id<"cardReadings">, cardNo: "7777", accessTime: "2026-10-17T10:00:00.000Z" }),
      reading({ _id: "foreign" as Id<"cardReadings">, projectId: "foreign" as Id<"projects">, cardNo: "777", accessTime: "2026-10-17T11:00:00.000Z" }),
    ]);
    const byCard = await invoke<{ page: { _id: string }[]; continueCursor: string }>(listFiltered, f.ctx, { projectId, search: " 777 ", paginationOpts: { numItems: 10, cursor: null } });
    expect(byCard.page.map(r => r._id)).toEqual(["card"]);
    expect(f.indexes).toContain("by_project_card_time");
    const first = await invoke<{ page: { _id: string }[]; continueCursor: string; isDone: boolean }>(listFiltered, f.ctx, { projectId, search: "ada", paginationOpts: { numItems: 1, cursor: null } });
    expect(first.page.map(r => r._id)).toEqual(["person"]);
    expect(f.indexes).toContain("by_project_employee_time");
    expect(await invoke(listFiltered, f.ctx, { projectId, search: "ada", paginationOpts: { numItems: 1, cursor: first.continueCursor } })).toMatchObject({ page: [], isDone: true });
  });
  it("server search keeps device, result and date filters and returns empty when nothing can match", async () => {
    const f = context([
      reading({ _id: "granted" as Id<"cardReadings">, cardNo: "777", deviceId, accessStatus: "izin_verildi" }),
      reading({ _id: "denied" as Id<"cardReadings">, cardNo: "777", deviceId, accessStatus: "reddedildi" }),
      reading({ _id: "old" as Id<"cardReadings">, cardNo: "777", deviceId, accessStatus: "reddedildi", accessTime: "2026-09-01T08:00:00.000Z" }),
      reading({ _id: "elsewhere" as Id<"cardReadings">, cardNo: "777", accessStatus: "reddedildi" }),
    ]);
    const paginationOpts = { numItems: 10, cursor: null };
    const page = await invoke<{ page: { _id: string }[] }>(listFiltered, f.ctx, { projectId, search: "777", deviceId, result: "denied", startDate: "2026-10-17", endDate: "2026-10-17", paginationOpts });
    expect(page.page.map(r => r._id)).toEqual(["denied"]);
    expect(await invoke(listFiltered, f.ctx, { projectId, search: "Ada Yok", paginationOpts })).toMatchObject({ page: [], isDone: true, scannedCount: 0 });
  });
  it("employee and unknown-result index paths stay scoped", async () => {
    const f = context([reading({ employeeId }), reading({ _id: "denied" as Id<"cardReadings">, employeeId, accessStatus: "reddedildi" })]);
    const paginationOpts = { numItems: 200, cursor: null };
    expect(await invoke(listFiltered, f.ctx, { projectId, employeeId, result: "unknown", paginationOpts })).toMatchObject({ page: [{ _id: readingId }], scannedCount: 2 });
    expect(f.indexes).toContain("by_project_employee_time");
    expect(await invoke(listFiltered, f.ctx, { projectId, result: "unknown", paginationOpts })).toMatchObject({ page: [{ _id: readingId }], scannedCount: 1 });
    expect(f.indexes).toContain("by_project_status_time");
  });
  it("rejects inaccessible project, mismatched door/device and invalid live bounds", async () => {
    const f = context();
    await expect(invoke(listLiveSince, f.ctx, { projectId: "foreign", limit: 10 })).rejects.toThrow("Bu projeye erişim yetkiniz yok");
    for (const limit of [0, 501, 1.5, NaN]) await expect(invoke(listLiveSince, f.ctx, { projectId, limit })).rejects.toThrow();
    await expect(invoke(listLiveSince, f.ctx, { projectId, limit: 10, afterCreationTime: NaN })).rejects.toThrow();
    await expect(invoke(listFiltered, f.ctx, { projectId, doorId, deviceId: "other", paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow("Seçili kapı bu cihaza bağlı değil");
  });
});


describe("api-fix inactive assignment", () => {
  it("rejects inactive employees with a Turkish error before mutation, audit or scheduling", async () => {
    expect(assignmentPrecondition({ ...precondition, employeeIsActive: false })).toBe("EMPLOYEE_INACTIVE");
    const f = context();
    f.employee.isActive = false;
    await expect(invoke(assignCardFromReading, f.ctx, { readingId, employeeId, expectedCurrentCard: "old" }))
      .rejects.toMatchObject({ data: { code: "EMPLOYEE_INACTIVE", message: "Pasif kişiye kart atanamaz" } });
    expect(f.ctx.runMutation).not.toHaveBeenCalled();
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.runAfter).not.toHaveBeenCalled();
    expect(f.tables.auditLog).toHaveLength(0);
  });
  it("does not count inactive or unsupported devices as sync targets", async () => {
    const f = context();
    f.tables.accessRules = [{ _id: "rule", projectId, isActive: true }];
    f.tables.groupMembers = [{ projectId, employeeId, groupId: "rule" }];
    f.tables.groupDevices = [{ projectId, groupId: "rule", deviceId }];
    f.tables.devices[0] = { ...f.tables.devices[0], brand: "hikvision", isActive: false };
    expect(await invoke(assignCardFromReading, f.ctx, { readingId, employeeId, expectedCurrentCard: "old" })).toMatchObject({ syncStatus: "noTargets" });
  });
});


describe("monitoring audit query regressions", () => {
  it.each(["card", "qr", "mobile", "biometric"] as const)("filters %s on the server in history and live", async source => {
    const rows = ["card", "qr", "mobile", "biometric"].map((kind, i) => reading({
      _id: kind as Id<"cardReadings">, _creationTime: 100 + i,
      rawData: JSON.stringify({ source: kind }), ...(kind === "biometric" ? { hikCurrentVerifyMode: "face" } : {}),
    }));
    const f = context(rows);
    expect(await invoke(listFiltered, f.ctx, { projectId, source, paginationOpts: { numItems: 100, cursor: null } })).toMatchObject({ page: [{ _id: source }], scannedCount: 4 });
    expect(await invoke(listLiveSince, f.ctx, { projectId, source, afterCreationTime: 0, limit: 500 })).toMatchObject({ rows: [{ _id: source }], latestCreationTime: 103 });
  });
  it("scans past nonmatching candidates to fill the source page", async () => {
    const f = context([reading({ _id: "card" as Id<"cardReadings">, accessTime: "2026-10-18T00:00:00Z" }), reading({ _id: "qr" as Id<"cardReadings">, rawData: '{"source":"qr"}' })]);
    const args = { projectId, source: "qr", paginationOpts: { numItems: 1, cursor: null } };
    expect(await invoke(listFiltered, f.ctx, args)).toMatchObject({ page: [{ _id: "qr" }], scannedCount: 2, matchedCount: 1, scanLimitReached: false });
  });
  it("source history scan stops at budget and resumes without skipping the later match", async () => {
    const cards = Array.from({ length: 2001 }, (_, i) => reading({ _id: `c${i}` as Id<"cardReadings">, _creationTime: 4000 - i, accessTime: new Date(1_800_000_000_000 - i * 1000).toISOString() }));
    const qr = reading({ _id: "later-qr" as Id<"cardReadings">, _creationTime: 1, accessTime: "2020-01-01T00:00:00Z", rawData: '{"source":"qr"}' });
    const f = context([...cards, qr]);
    const args = { projectId, source: "qr", paginationOpts: { numItems: 1, cursor: null } };
    const first = await invoke<{ continueCursor: string }>(listFiltered, f.ctx, args);
    expect(first).toMatchObject({ page: [], scannedCount: 2000, matchedCount: 0, scanLimitReached: true, isDone: false });
    expect(await invoke(listFiltered, f.ctx, { ...args, paginationOpts: { numItems: 1, cursor: first.continueCursor } })).toMatchObject({ page: [{ _id: "later-qr" }], scannedCount: 2, matchedCount: 1, scanLimitReached: false });
  });
  it("live source scan finds sparse matches beyond the old 500 candidates and reports budget exhaustion", async () => {
    const cards = Array.from({ length: 600 }, (_, i) => reading({ _id: `c${i}` as Id<"cardReadings">, _creationTime: 4000 - i }));
    const qr = reading({ _id: "sparse-qr" as Id<"cardReadings">, _creationTime: 1, rawData: '{"source":"qr"}' });
    const f = context([...cards, qr]);
    expect(await invoke(listLiveSince, f.ctx, { projectId, source: "qr", afterCreationTime: 0, limit: 1 })).toMatchObject({ rows: [{ _id: "sparse-qr" }], scannedCount: 601, matchedCount: 1, latestCreationTime: 4000, hasMore: false });
    f.tables.cardReadings = Array.from({ length: 2001 }, (_, i) => reading({ _id: `c${i}` as Id<"cardReadings">, _creationTime: 4000 - i }));
    expect(await invoke(listLiveSince, f.ctx, { projectId, source: "qr", afterCreationTime: 0, limit: 1 })).toMatchObject({ rows: [], scannedCount: 2000, matchedCount: 0, scanLimitReached: true, hasMore: true });
  });
  it("person search excludes visitors, including explicitly selected visitor IDs", async () => {
    const f = context();
    f.tables.employees.push({ ...f.employee, _id: "visitor", isVisitor: true });
    for (const search of ["", "Ada", "Test"]) {
      expect(await invoke(searchMonitoringPeople, f.ctx, { projectId, search, selectedId: "visitor" })).toMatchObject([{ _id: employeeId }]);
      expect(await invoke<unknown[]>(searchMonitoringPeople, f.ctx, { projectId, search, selectedId: "visitor" })).toHaveLength(1);
    }
  });
  it("person picker bounds results, searches both names and preserves selected person", async () => {
    const f = context();
    f.tables.employees = Array.from({ length: 100 }, (_, i) => ({ ...f.employee, _id: `person${i}`, firstName: `Ada${i}`, lastName: i === 99 ? "Unique" : "Test" }));
    expect(await invoke<unknown[]>(searchMonitoringPeople, f.ctx, { projectId, search: "" })).toHaveLength(20);
    expect(await invoke(searchMonitoringPeople, f.ctx, { projectId, search: "Unique" })).toMatchObject([{ _id: "person99" }]);
    const selected = await invoke<{ _id: string }[]>(searchMonitoringPeople, f.ctx, { projectId, search: "Ada", selectedId: "person99" });
    expect(selected.length).toBeLessThanOrEqual(41);
    expect(selected.some(person => person._id === "person99")).toBe(true);
    expect(f.indexes).toContain("search_first_name"); expect(f.indexes).toContain("search_last_name");
  });
  it("last reading includes earlier days and rejects foreign scope", async () => {
    const f = context([reading({ accessTime: "2025-01-01T00:00:00Z" })]);
    expect(await invoke(lastMonitoringReading, f.ctx, { projectId })).toEqual({ accessTime: "2025-01-01T00:00:00Z" });
    await expect(invoke(lastMonitoringReading, f.ctx, { projectId: "foreign" })).rejects.toThrow();
    expect(await invoke(getReading, f.ctx, { readingId: "invalid" })).toBeNull();
  });
});
