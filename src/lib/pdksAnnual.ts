import type { ConvexReactClient } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { annualOvertimeRanges, mergeAnnualBalances } from "../../convex/lib/annualOvertime";
import { addWorkDate } from "../../convex/lib/pdksWorkDay";
import { trDayRangeISO, trTodayKey } from "../../convex/lib/trDate";
import { checkPdksCancelled, pdksShared, type PdksSharedEntry } from "./pdksAsync";
import { pdksEpoch } from "./pdksInvalidation";
import { loadPdksSource, pdksMapConcurrent, type PdksCachedReading } from "./pdksBatches";
import { isPdksBudgetError } from "./pdksErrors";
export type AnnualArgs = FunctionArgs<typeof api.dashboard.getAnnualOvertimeBalance>;
export type AnnualRows = FunctionReturnType<typeof api.dashboard.getAnnualOvertimeBalance>;
type Client = Pick<ConvexReactClient, "query">;
const cache = new WeakMap<Client, Map<string, PdksSharedEntry<AnnualRows>>>();

/** Month inputs are read once; weekly settlement retains its full neighbouring context. */
async function calculate(client: Client, args: AnnualArgs, signal: AbortSignal): Promise<AnnualRows> {
  const projectId = args.projectId;
  if (!projectId) throw new Error("Bir proje seçin");
  const year = args.year ?? Number(trTodayKey().slice(0, 4));
  const ranges = annualOvertimeRanges(year);
  const roster: FunctionReturnType<typeof api.dashboard.getAnnualOvertimeRoster>["page"] = [];
  let cursor: string | null = null;
  for (;;) {
    checkPdksCancelled(signal);
    const page = await client.query(api.dashboard.getAnnualOvertimeRoster, { projectId, cursor });
    roster.push(...page.page);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  const owners = new Map(roster.map(employee => [employee.cardNumber, employee.employeeId]));
  const ids = new Set(roster.map(employee => employee.employeeId));
  const clusters = new Map<string, typeof roster>();
  for (const employee of roster) {
    const key = employee.cardNumber || employee.employeeId;
    const group = clusters.get(key) ?? [];
    group.push(employee);
    clusters.set(key, group);
  }
  const groups: typeof roster[] = [];
  for (const cluster of clusters.values()) {
    const last = groups[groups.length - 1];
    if (!last || last.length + cluster.length > 20) groups.push([...cluster]);
    else last.push(...cluster);
  }
  const selected = args.employeeId ? groups.filter(group => group.some(employee => employee.employeeId === args.employeeId)) : groups;
  if (!selected.length) return [];
  const byMonth = new Map<string, typeof ranges>();
  for (const range of ranges) {
    const month = range.startDate.slice(0, 7);
    const weeks = byMonth.get(month) ?? [];
    weeks.push(range);
    byMonth.set(month, weeks);
  }
  const parts: AnnualRows[] = [];
  for (const weeks of byMonth.values()) {
    checkPdksCancelled(signal);
    const first = weeks[0], last = weeks[weeks.length - 1];
    if (!first || !last) continue;
    const from = addWorkDate(first.startDate, -8), to = addWorkDate(last.endDate, 3);
    const months = new Set([from.slice(0, 7), first.startDate.slice(0, 7), to.slice(0, 7)]);
    const readings = new Map<string, PdksCachedReading>();
    for (const month of [...months].sort()) {
      const [sourceYear, sourceMonth] = month.split("-").map(Number);
      const monthStart = `${month}-01`, monthEnd = `${month}-${new Date(Date.UTC(sourceYear, sourceMonth, 0)).getUTCDate()}`;
      const startDate = sourceYear < year ? from : monthStart;
      const endDate = sourceYear > year ? to : monthEnd;
      const source = await loadPdksSource(client, { kind: "table", args: { projectId, startDate, endDate } }, roster, signal);
      for (const reading of source.readings) readings.set(reading._id, reading);
    }
    const byEmployee = new Map<typeof roster[number]["employeeId"], PdksCachedReading[]>();
    for (const reading of readings.values()) {
      const owner = reading.employeeId && ids.has(reading.employeeId) ? reading.employeeId : owners.get(reading.cardNo);
      if (!owner) continue;
      const list = byEmployee.get(owner) ?? [];
      list.push(reading);
      byEmployee.set(owner, list);
    }
    const tasks = weeks.flatMap(range => selected.map(group => ({ range, group })));
    const calculated = await pdksMapConcurrent(tasks, async ({ range, group }) => {
      const coverage = trDayRangeISO(addWorkDate(range.startDate, -8), addWorkDate(range.endDate, 3));
      const part = async (employees: typeof roster): Promise<AnnualRows[]> => {
        checkPdksCancelled(signal);
        const own = new Set(employees.map(employee => employee.employeeId));
        const source = employees.flatMap(employee => byEmployee.get(employee.employeeId) ?? [])
          .filter(reading => reading.accessTime >= coverage.startISO && reading.accessTime <= coverage.endISO)
          .sort((a, b) => a.accessTime.localeCompare(b.accessTime) || a._creationTime - b._creationTime);
        try {
          return [await client.query(api.dashboard.getAnnualOvertimePart, { ...args, year, ...range,
            employeeIds: employees.map(employee => employee.employeeId), roster, readings: source,
            readingStartISO: coverage.startISO, readingEndISO: coverage.endISO })];
        } catch (error) {
          if (!isPdksBudgetError(error)) throw error;
          const ownClusters = [...clusters.values()].filter(cluster => cluster.some(employee => own.has(employee.employeeId)));
          if (ownClusters.length < 2) throw error;
          const middle = Math.ceil(ownClusters.length / 2);
          return [...await part(ownClusters.slice(0, middle).flat()), ...await part(ownClusters.slice(middle).flat())];
        }
      };
      return part(group);
    }, signal);
    parts.push(...calculated.flat());
  }
  return mergeAnnualBalances(parts);
}
export async function loadAnnualOvertime(client: Client, args: AnnualArgs, signal?: AbortSignal): Promise<AnnualRows> {
  checkPdksCancelled(signal);
  if (!args.projectId) throw new Error("Bir proje seçin");
  const accountId = await client.query(api.dashboard.getAnnualOvertimeAccess, { projectId: args.projectId });
  checkPdksCancelled(signal);
  let entries = cache.get(client);
  if (!entries) { entries = new Map(); cache.set(client, entries); }
  const key = JSON.stringify([pdksEpoch(), accountId, args.projectId, args.year ?? Number(trTodayKey().slice(0, 4)), args.employeeId]);
  return pdksShared(entries, key, sharedSignal => calculate(client, args, sharedSignal), signal, 5);
}
