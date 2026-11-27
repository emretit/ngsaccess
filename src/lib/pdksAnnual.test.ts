import { expect, it } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { loadAnnualOvertime } from "./pdksAnnual";


it("two annual consumers share a five-minute result and no more than four monthly requests", async () => {
  let active = 0, peak = 0, weeks = 0, version = "v1";
  const employeeId = "employee" as Id<"employees">;
  const query = async (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getAnnualOvertimeAccess")) return "account";
    if (name.endsWith(":getAnnualOvertimeRoster")) return { page: [{ employeeId, cardNumber: "1" }], isDone: true, continueCursor: "" };
    if (name.endsWith(":sourceVersion")) return version;
    if (name.endsWith(":unlinkedPage")) return { readings: [], startISO: "2025-12-01T00:00:00Z", endISO: "2027-01-02T00:00:00Z", isDone: true, continueCursor: "" };
    expect(name).toBe("pdksAnnual:month");
    active++; peak = Math.max(peak, active); weeks++;
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return [{ employeeId, firstName: "Ada", lastName: "Test", totalOvertimeMinutes: 1, totalOvertimeHours: 0, limitHours: 270, remainingHours: 270, utilizationPct: 0, exceedsDaily11h: [] }];
  };
  const client = { query } as unknown as Parameters<typeof loadAnnualOvertime>[0];
  const args = { projectId: "project" as Id<"projects">, year: 2026 };
  const [alert, preset] = await Promise.all([loadAnnualOvertime(client, args), loadAnnualOvertime(client, args)]);
  expect(preset).toEqual(alert);
  expect(alert[0]?.totalOvertimeMinutes).toBe(12);
  expect(weeks).toBe(12);
  expect(peak).toBe(1);
  expect(await loadAnnualOvertime(client, args)).toEqual(alert);
  expect(weeks).toBe(12);
  version = "v2";
  await loadAnnualOvertime(client, args);
  expect(weeks).toBe(24);
});
it("unmount/year change stops scheduling monthly work after the four in-flight queries", async () => {
  const controller = new AbortController();
  const releases: (() => void)[] = [];
  let calls = 0;
  let ready: (() => void) | undefined;
  const started = new Promise<void>(resolve => { ready = resolve; });
  const query = async (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getAnnualOvertimeAccess")) return "account";
    if (name.endsWith(":getAnnualOvertimeRoster")) return { page: Array.from({ length: 256 }, (_, i) => ({ employeeId: `employee-${i}`, cardNumber: String(i) })), isDone: true, continueCursor: "" };
    if (name.endsWith(":sourceVersion")) return "version1";
    if (name.endsWith(":unlinkedPage")) return { readings: [], startISO: "2025-12-01T00:00:00Z", endISO: "2027-01-02T00:00:00Z", isDone: true, continueCursor: "" };
    calls++;
    await new Promise<void>(resolve => { releases.push(resolve); if (calls === 4) ready?.(); });
    return [];
  };
  const client = { query } as unknown as Parameters<typeof loadAnnualOvertime>[0];
  const work = loadAnnualOvertime(client, { projectId: "project" as Id<"projects">, year: 2026 }, controller.signal);
  const cancelled = expect(work).rejects.toThrow("iptal edildi");
  await started;
  controller.abort();
  releases.forEach(release => release());
  await cancelled;
  await new Promise(resolve => setTimeout(resolve, 1));
  expect(calls).toBe(4);
});

it("rechecks project access before serving a cached annual result", async () => {
  let allowed = true, calculations = 0;
  const query = async (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getAnnualOvertimeAccess")) {
      if (!allowed) throw new Error("Yetkiniz yok");
      return "account";
    }
    if (name.endsWith(":sourceVersion")) return "version1";
    calculations++;
    expect(name).toBe("dashboard:getAnnualOvertimeRoster");
    return { page: [], isDone: true, continueCursor: "" };
  };
  const client = { query } as unknown as Parameters<typeof loadAnnualOvertime>[0];
  const args = { projectId: "project" as Id<"projects">, year: 2026 };
  expect(await loadAnnualOvertime(client, args)).toEqual([]);
  allowed = false;
  await expect(loadAnnualOvertime(client, args)).rejects.toThrow("Yetkiniz yok");
  expect(calculations).toBe(1);
});

it("500 people use at most 120 calls including roster, authorization, source and calculation, with concurrency four", async () => {
  let calls = 0, active = 0, peak = 0;
  const roster = Array.from({ length: 500 }, (_, i) => ({ employeeId: `employee-${i}` as Id<"employees">, cardNumber: String(i) }));
  const query = async (ref: FunctionReference<"query">, args: Record<string, unknown>) => {
    calls++;
    const name = getFunctionName(ref);
    if (name.endsWith(":getAnnualOvertimeAccess")) return "account";
    if (name.endsWith(":sourceVersion")) return "v1";
    if (name.endsWith(":getAnnualOvertimeRoster")) {
      const offset = args.cursor === null ? 0 : Number(args.cursor);
      return { page: roster.slice(offset, offset + 100), isDone: offset + 100 >= 500, continueCursor: String(offset + 100) };
    }
    if (name.endsWith(":unlinkedPage")) return { readings: [], startISO: "2025-12-01T00:00:00Z", endISO: "2027-01-02T00:00:00Z", isDone: true, continueCursor: "" };
    expect(name).toBe("pdksAnnual:month");
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--;
    return (args.employeeIds as string[]).map(employeeId => ({ employeeId, firstName: "A", lastName: employeeId, totalOvertimeMinutes: 1, totalOvertimeHours: 0, limitHours: 270, remainingHours: 270, utilizationPct: 0, exceedsDaily11h: [] }));
  };
  const rows = await loadAnnualOvertime({ query } as unknown as Parameters<typeof loadAnnualOvertime>[0], { projectId: "project" as Id<"projects">, year: 2026 });
  expect(rows).toHaveLength(500);
  expect(rows.every(row => row.totalOvertimeMinutes === 12)).toBe(true);
  expect(calls).toBe(115);
  expect(peak).toBe(4);
});
