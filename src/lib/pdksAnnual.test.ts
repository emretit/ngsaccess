import { expect, it } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import { loadAnnualOvertime } from "./pdksAnnual";
import { annualOvertimeRanges } from "../../convex/lib/annualOvertime";

it("two annual consumers share a five-minute result and no more than four weekly requests", async () => {
  let active = 0, peak = 0, weeks = 0;
  const employeeId = "employee" as Id<"employees">;
  const query = async (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getAnnualOvertimeAccess")) return "account";
    if (name.endsWith(":getAnnualOvertimeRoster")) return { page: [{ employeeId, cardNumber: "1" }], isDone: true, continueCursor: "" };
    if (name.endsWith(":unassignedDatesPage")) return { readings: [], sourceBytes: 0, isDone: true, continueCursor: "" };
    expect(name).toBe("dashboard:getAnnualOvertimePart");
    active++; peak = Math.max(peak, active); weeks++;
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return [{ employeeId, firstName: "Ada", lastName: "Test", totalOvertimeMinutes: 1, totalOvertimeHours: 0, limitHours: 270, remainingHours: 270, utilizationPct: 0, exceedsDaily11h: [] }];
  };
  const client = { query } as unknown as Parameters<typeof loadAnnualOvertime>[0];
  const args = { projectId: "project" as Id<"projects">, year: 2026 };
  const [alert, preset] = await Promise.all([loadAnnualOvertime(client, args), loadAnnualOvertime(client, args)]);
  expect(preset).toEqual(alert);
  expect(alert[0]?.totalOvertimeMinutes).toBe(annualOvertimeRanges(2026).length);
  expect(weeks).toBe(annualOvertimeRanges(2026).length);
  expect(peak).toBe(4);
  expect(await loadAnnualOvertime(client, args)).toEqual(alert);
  expect(weeks).toBe(53);
});
it("unmount/year change stops scheduling weekly work after the four in-flight queries", async () => {
  const controller = new AbortController();
  const releases: (() => void)[] = [];
  let calls = 0;
  let ready: (() => void) | undefined;
  const started = new Promise<void>(resolve => { ready = resolve; });
  const query = async (ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getAnnualOvertimeAccess")) return "account";
    if (name.endsWith(":getAnnualOvertimeRoster")) return { page: [{ employeeId: "employee", cardNumber: "1" }], isDone: true, continueCursor: "" };
    if (name.endsWith(":unassignedDatesPage")) return { readings: [], sourceBytes: 0, isDone: true, continueCursor: "" };
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
