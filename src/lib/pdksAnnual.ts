import type { ConvexReactClient } from "convex/react";
import { ConvexError } from "convex/values";
import { makeFunctionReference, type ApiFromModules, type FunctionArgs, type FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import type * as annual from "../../convex/pdksAnnual";
import type { Id } from "../../convex/_generated/dataModel";
import { annualOvertimeRanges, mergeAnnualBalances, type AnnualBalanceRow } from "../../convex/lib/annualOvertime";
import { trTodayKey } from "../../convex/lib/trDate";
import { checkPdksCancelled, pdksShared, type PdksSharedEntry } from "./pdksAsync";
import { pdksEpoch } from "./pdksInvalidation";
import { pdksBatchRefs, pdksMapConcurrent, pdksReadingPayloadTooLarge } from "./pdksBatches";
import { isPdksBudgetError, pdksErrorCode } from "./pdksErrors";
export type AnnualArgs = { projectId?: Id<"projects">; year?: number; employeeId?: Id<"employees"> };
export type AnnualRows = AnnualBalanceRow[];
type AnnualApi = ApiFromModules<{ pdksAnnual: typeof annual }>["pdksAnnual"];
export const annualRefs = {
  month: makeFunctionReference<"query", FunctionArgs<AnnualApi["month"]>, FunctionReturnType<AnnualApi["month"]>>("pdksAnnual:month"),
  unlinked: makeFunctionReference<"query", FunctionArgs<AnnualApi["unlinkedPage"]>, FunctionReturnType<AnnualApi["unlinkedPage"]>>("pdksAnnual:unlinkedPage"),
};
type Client = Pick<ConvexReactClient, "query">;
const cache = new WeakMap<Client, Map<string, PdksSharedEntry<AnnualRows>>>();

export function invalidateAnnualOvertime(client: Client) { cache.delete(client); }

/** Whole-week monthly pieces preserve weekly settlement without 53 × group requests. */
async function calculate(client: Client, args: AnnualArgs, version: string, signal: AbortSignal): Promise<AnnualRows> {
  const projectId = args.projectId;
  if (!projectId) throw new Error("Bir proje seçin");
  const year = args.year ?? Number(trTodayKey().slice(0, 4));
  const roster: FunctionReturnType<typeof api.dashboard.getAnnualOvertimeRoster>["page"] = [];
  let cursor: string | null = null;
  for (;;) {
    checkPdksCancelled(signal);
    const page: FunctionReturnType<typeof api.dashboard.getAnnualOvertimeRoster> = await client.query(api.dashboard.getAnnualOvertimeRoster, { projectId, cursor });
    roster.push(...page.page);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  const owners = new Map(roster.filter(employee => employee.cardNumber).map(employee => [employee.cardNumber, employee.employeeId]));
  const clusters = new Map<string, typeof roster>();
  for (const employee of roster) {
    const key = employee.cardNumber || employee.employeeId;
    const group = clusters.get(key) ?? []; group.push(employee); clusters.set(key, group);
  }
  const groups: typeof roster[] = [];
  for (const cluster of clusters.values()) {
    const last = groups[groups.length - 1];
    if (!last || last.length + cluster.length > 64) groups.push([...cluster]);
    else last.push(...cluster);
  }
  const selected = args.employeeId ? groups.filter(group => group.some(employee => employee.employeeId === args.employeeId)) : groups;
  if (!selected.length) return [];
  const months = new Map<string, { startDate: string; endDate: string }>();
  for (const range of annualOvertimeRanges(year)) {
    const key = range.startDate.slice(0, 7), previous = months.get(key);
    months.set(key, { startDate: previous?.startDate ?? range.startDate, endDate: range.endDate });
  }
  const parts: AnnualRows[] = [];
  // Process months in order, retaining at most one month's small unlinked badge input.
  for (const range of months.values()) {
    checkPdksCancelled(signal);
    const readings: FunctionReturnType<AnnualApi["unlinkedPage"]>["readings"] = [];
    let page: FunctionReturnType<AnnualApi["unlinkedPage"]>;
    let cursor: string | null = null;
    for (;;) {
      checkPdksCancelled(signal);
      page = await client.query(annualRefs.unlinked, { projectId, year, ...range, cursor });
      readings.push(...page.readings);
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    const part = async (employees: typeof roster): Promise<AnnualRows[]> => {
      checkPdksCancelled(signal);
      const own = new Set(employees.map(employee => employee.employeeId));
      const unlinked = readings.filter(reading => !!owners.get(reading.cardNo) && own.has(owners.get(reading.cardNo) as Id<"employees">));
      // Avoid Convex array/value argument limits before invoking the function.
      try {
        if (pdksReadingPayloadTooLarge(unlinked)) throw new ConvexError({ code: "PDKS_READ_BUDGET" });
        return [await client.query(annualRefs.month, { projectId, year, ...range, ...(args.employeeId ? { employeeId: args.employeeId } : {}),
          employeeIds: employees.map(employee => employee.employeeId), unlinked, sourceVersion: version, readingStartISO: page.startISO, readingEndISO: page.endISO })];
      } catch (error) {
        if (!isPdksBudgetError(error)) throw error;
        const units = [...clusters.values()].filter(cluster => cluster.some(employee => own.has(employee.employeeId)));
        if (units.length < 2) throw error;
        const middle = Math.ceil(units.length / 2);
        return [...await part(units.slice(0, middle).flat()), ...await part(units.slice(middle).flat())];
      }
    };
    parts.push(...(await pdksMapConcurrent(selected, part, signal)).flat());
  }
  const order = new Map(roster.map((employee, index) => [employee.employeeId, index]));
  return mergeAnnualBalances(parts).sort((a, b) => b.utilizationPct - a.utilizationPct || (order.get(a.employeeId) ?? 0) - (order.get(b.employeeId) ?? 0));
}
export async function loadAnnualOvertime(client: Client, args: AnnualArgs, signal?: AbortSignal): Promise<AnnualRows> {
  checkPdksCancelled(signal);
  if (!args.projectId) throw new Error("Bir proje seçin");
  const accountId = await client.query(api.dashboard.getAnnualOvertimeAccess, { projectId: args.projectId });
  for (let retry = 0; ; retry++) {
    const version = await client.query(pdksBatchRefs.version, { projectId: args.projectId });
    checkPdksCancelled(signal);
    let entries = cache.get(client);
    if (!entries) { entries = new Map(); cache.set(client, entries); }
    const key = JSON.stringify([pdksEpoch(), accountId, version, args.projectId, args.year ?? Number(trTodayKey().slice(0, 4)), args.employeeId]);
    try { return await pdksShared(entries, key, sharedSignal => calculate(client, args, version, sharedSignal), signal, 5); }
    catch (error) { if (retry || pdksErrorCode(error) !== "PDKS_SOURCE_STALE") throw error; entries.delete(key); }
  }
}
