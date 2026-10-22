import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../convex/_generated/server";
import { filteredLeaves, conflictFor } from "../../../convex/leaves";

const fixture = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], indexes: [] as string[] }));
vi.mock("../../../convex/lib/customFunctions", () => ({ authedQuery: (x: unknown) => x, authedMutation: (x: unknown) => x }));
vi.mock("../../../convex/lib/projectScope", () => ({ resolveProjectScope: vi.fn() }));
vi.mock("convex-helpers/server/stream", () => ({ stream: () => ({ query: () => {
  let rows = [...fixture.rows];
  const range = { eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return range; }, gte: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) >= value); return range; }, lte: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) <= value); return range; } };
  let predicate: (row: Record<string, unknown>) => Promise<boolean> = async () => true;
  const matching = async () => { const flags = await Promise.all(rows.map(predicate)); return rows.filter((_, i) => flags[i]); };
  const chain = {
    withIndex: (name: string, configure: (q: typeof range) => unknown) => { fixture.indexes.push(name); configure(range); return chain; },
    order: () => chain,
    filterWith: (fn: typeof predicate) => { predicate = fn; return chain; },
    first: async () => (await matching())[0] ?? null,
    paginate: async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
      const matched = await matching(); const start = Number(cursor ?? 0);
      return { page: matched.slice(start, start + numItems), continueCursor: String(start + numItems), isDone: start + numItems >= matched.length };
    },
  }; return chain;
} }) }));
const projectId = "p" as Id<"projects">;
const employeeId = "e" as Id<"employees">;
const ctx = { db: { get: async () => ({ projectId }) } } as unknown as QueryCtx;
const base = { projectId, employeeId, leaveType: "annual", startDate: "2026-10-01", endDate: "2026-10-03", status: "approved" };
beforeEach(() => { fixture.rows = []; fixture.indexes = []; });
describe("indexed leave filtering", () => {
  it.each([
    [{}, "by_project_end"],
    [{ employeeId }, "by_project_employee_end"],
    [{ leaveType: "annual" as const }, "by_project_type_end"],
    [{ employeeId, leaveType: "annual" as const }, "by_project_employee_type_end"],
  ])("selects the equality index and filters the whole stream before pagination", async (filters, index) => {
    fixture.rows = [...Array.from({ length: 5501 }, (_, n) => ({ ...base, _id: String(n), startDate: "2027-01-01", endDate: "2027-01-02" })), { ...base, _id: "match" }, { ...base, _id: "long", startDate: "2020-01-01" }];
    const args = { projectId, rangeStart: "2026-10-01", rangeEnd: "2026-10-31", ...filters };
    const first = await filteredLeaves(ctx, args).paginate({ cursor: null, numItems: 1 });
    expect(first.page.map(row => row._id)).toEqual(["match"]);
    const second = await filteredLeaves(ctx, args).paginate({ cursor: first.continueCursor, numItems: 1 });
    expect(second.page.map(row => row._id)).toEqual(["long"]);
    expect(second.isDone).toBe(true);
    expect(fixture.indexes).toEqual([index, index]);
  });
});
describe("read-only preflight", () => {
  const handler = (conflictFor as unknown as { handler: (ctx: QueryCtx, args: { projectId: Id<"projects">; employeeId: Id<"employees">; startDate: string; endDate: string; excludeLeaveId?: Id<"leaves"> }) => Promise<unknown> }).handler;
  const args = { projectId, employeeId, startDate: base.startDate, endDate: base.endDate };
  it("ignores legacy pending/rejected and the edited row, but reports approved overlaps", async () => {
    fixture.rows = [{ ...base, _id: "pending", status: "pending" }, { ...base, _id: "rejected", status: "rejected" }, { ...base, _id: "approved" }];
    expect(await handler(ctx, args)).toEqual({ id: "approved", start: base.startDate, end: base.endDate });
    expect(await handler(ctx, { ...args, excludeLeaveId: "approved" as Id<"leaves"> })).toBeNull();
  });
  it("rejects reversed or too-long dates before a write is attempted", async () => {
    await expect(handler(ctx, { ...args, endDate: "2026-09-30" })).rejects.toThrow();
    await expect(handler(ctx, { ...args, endDate: "2028-10-01" })).rejects.toThrow();
    expect(fixture.indexes).toHaveLength(0);
  });
});
