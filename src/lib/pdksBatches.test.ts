import { ConvexError } from "convex/values";
import { expect, it } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { loadPdksTable, loadPdksPayroll } from "./pdksBatches";

it("1,000 people merge without a cap; oversized groups split and global availability survives", async () => {
  const roster = Array.from({ length: 1000 }, (_, i) => ({ employeeId: `employee-${i}` as Id<"employees">, cardNumber: String(i) }));
  let maxGroup = 0, split = 0;
  const query = async (ref: FunctionReference<"query">, args: Record<string, unknown>) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":sourceVersion")) return "v1";
    if (name.endsWith(":rosterPage")) {
      const offset = args.cursor === null ? 0 : Number(args.cursor);
      return { page: roster.slice(offset, offset + 100), isDone: offset + 100 >= roster.length, continueCursor: String(offset + 100) };
    }
    if (name.endsWith(":unassignedDatesPage")) return { readings: [{ cardNo: "unassigned", unassignedDate: "2026-06-02" }], sourceBytes: 100, startISO: "2026-05-01T00:00:00Z", endISO: "2026-07-02T00:00:00Z", isDone: true, continueCursor: "" };
    if (!Array.isArray(args.employeeIds)) throw new Error("Missing employee group");
    const group = args.employeeIds as string[];
    if (group.length > 10) { split++; const error = new ConvexError({ code: "PDKS_READ_BUDGET" }); error.message = "Server Error"; throw error; }
    maxGroup = Math.max(maxGroup, group.length);
    if (!args.availabilityOnly) expect(args.availableDates).toEqual(expect.arrayContaining(["2026-06-01", "2026-06-02"]));
    return { kind: "table", rows: args.availabilityOnly ? [] : group.map(employeeId => ({ employeeId, name: employeeId, days: [] })), availableDates: ["2026-06-01"], hasFlexible: false, eligibleEmployeeIds: group };
  };
  const result = await loadPdksTable({ query } as unknown as Parameters<typeof loadPdksTable>[0], { projectId: "project" as Id<"projects">, startDate: "2026-06-01", endDate: "2026-06-30" });
  expect(result).toHaveLength(1000);
  expect(new Set(result.map(row => row.employeeId)).size).toBe(1000);
  expect(maxGroup).toBe(10);
  expect(split).toBe(100);
});
it("closed payroll export loads all 500 frozen people instead of only the first 25", async () => {
  let pages = 0;
  const query = async (ref: FunctionReference<"query">, args: Record<string, unknown>) => {
    expect(getFunctionName(ref)).toBe("pdksBatches:closedPayrollPage");
    const offset = args.cursor === null ? 0 : Number(args.cursor);
    pages++;
    return { sheet: { days: ["2026-06-01"], rows: Array.from({ length: 25 }, (_, i) => ({ employeeId: String(offset + i), name: String(offset + i) })), year: 2026, month: 6, isClosed: true }, isDone: offset + 25 >= 500, continueCursor: String(offset + 25) };
  };
  const result = await loadPdksPayroll({ query } as unknown as Parameters<typeof loadPdksPayroll>[0], { projectId: "project" as Id<"projects">, year: 2026, month: 6 });
  expect(pages).toBe(20);
  expect(result.rows).toHaveLength(500);
  expect(result.snapshotTruncated).toBe(false);
});
it("a superseded load stops before issuing more transactions", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const query = async () => { calls++; throw new Error("Unexpected query"); };
  const client = { query } as unknown as Parameters<typeof loadPdksTable>[0];
  await expect(loadPdksTable(client, { projectId: "project" as Id<"projects"> }, controller.signal)).rejects.toThrow("iptal edildi");
  expect(calls).toBe(0);
});

it("setting versions change the source cache key and stale coverage is retried once", async () => {
  let version = "v1", sourceCalls = 0, stale = false;
  const employeeId = "employee" as Id<"employees">;
  const query = async (ref: FunctionReference<"query">, args: Record<string, unknown>) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":sourceVersion")) return version;
    if (name.endsWith(":rosterPage")) return { page: [{ employeeId, cardNumber: "1" }], isDone: true, continueCursor: "" };
    if (name.endsWith(":unassignedDatesPage")) { sourceCalls++; return { readings: [], sourceBytes: 0, startISO: "2026-05-25T00:00:00.000Z", endISO: "2026-07-02T00:00:00.000Z", isDone: true, continueCursor: "" }; }
    expect(args.readingStartISO).toBe("2026-05-25T00:00:00.000Z");
    expect(args.sourceVersion).toBe(version);
    if (stale) { stale = false; version = "v3"; throw new ConvexError({ code: "PDKS_SOURCE_STALE" }); }
    return { kind: "table", rows: [], availableDates: [], hasFlexible: false, eligibleEmployeeIds: [employeeId] };
  };
  const client = { query } as unknown as Parameters<typeof loadPdksTable>[0];
  const args = { projectId: "project" as Id<"projects">, startDate: "2026-06-01", endDate: "2026-06-30" };
  await loadPdksTable(client, args);
  await loadPdksTable(client, args);
  expect(sourceCalls).toBe(1);
  version = "v2";
  await loadPdksTable(client, args);
  expect(sourceCalls).toBe(2);
  stale = true;
  await loadPdksTable(client, args);
  expect(sourceCalls).toBe(3);
});
