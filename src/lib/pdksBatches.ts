import { checkPdksCancelled as checkCancelled, pdksShared, type PdksSharedEntry } from "./pdksAsync";
import { trTodayKey } from "../../convex/lib/trDate";
import { isPdksBudgetError } from "./pdksErrors";
import { pdksEpoch } from "./pdksInvalidation";
import { makeFunctionReference, type ApiFromModules, type FunctionArgs, type FunctionReturnType } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import type * as batches from "../../convex/pdksBatches";
import type { api } from "../../convex/_generated/api";
type BatchApi = ApiFromModules<{ pdksBatches: typeof batches }>["pdksBatches"];
export const pdksBatchRefs = {
  roster: makeFunctionReference<"query", FunctionArgs<BatchApi["rosterPage"]>, FunctionReturnType<BatchApi["rosterPage"]>>("pdksBatches:rosterPage"),
  dates: makeFunctionReference<"query", FunctionArgs<BatchApi["unassignedDatesPage"]>, FunctionReturnType<BatchApi["unassignedDatesPage"]>>("pdksBatches:unassignedDatesPage"),
  calculate: makeFunctionReference<"query", FunctionArgs<BatchApi["calculate"]>, FunctionReturnType<BatchApi["calculate"]>>("pdksBatches:calculate"),
  closed: makeFunctionReference<"query", FunctionArgs<BatchApi["closedPayrollPage"]>, FunctionReturnType<BatchApi["closedPayrollPage"]>>("pdksBatches:closedPayrollPage"),
};
export type TableArgs = FunctionArgs<typeof api.cardReadings.getPdksTableData>;
export type TableRows = FunctionReturnType<typeof api.cardReadings.getPdksTableData>;
export type PayrollArgs = FunctionArgs<typeof api.cardReadings.getMonthlyPayrollSheet>;
export type PayrollSheet = FunctionReturnType<typeof api.cardReadings.getMonthlyPayrollSheet>;
type Client = Pick<ConvexReactClient, "query">;
type Request = FunctionArgs<BatchApi["calculate"]>["request"];

/** Every request is an independent bounded transaction; the client never publishes partial rows. */
export type PdksCachedReading = FunctionReturnType<BatchApi["unassignedDatesPage"]>["readings"][number];
type SourceBundle = { readings: PdksCachedReading[]; sourceBytes: number; endISO: string };
const sourceCache = new WeakMap<Client, Map<string, PdksSharedEntry<SourceBundle>>>();
function sourceKey(request: Request) {
  const date = request.kind === "table" ? request.args.date ?? trTodayKey() : "";
  const from = request.kind === "table" ? request.args.startDate ?? date : `${request.args.year}-${String(request.args.month).padStart(2, "0")}-01`;
  const to = request.kind === "table" ? request.args.endDate ?? date : `${request.args.year}-${String(request.args.month).padStart(2, "0")}-${new Date(Date.UTC(request.args.year, request.args.month, 0)).getUTCDate()}`;
  return `${pdksEpoch()}:${request.args.projectId}:${from}:${to}`;
}
export async function loadPdksSource(client: Client, request: Request, roster: FunctionReturnType<BatchApi["rosterPage"]>["page"], signal?: AbortSignal) {
  let cache = sourceCache.get(client);
  if (!cache) { cache = new Map(); sourceCache.set(client, cache); }
  return pdksShared(cache, sourceKey(request), async sharedSignal => {
    const readings: PdksCachedReading[] = [];
    let cursor: string | null = null, sourceBytes = 0;
    let endISO: string;
    for (;;) {
      checkCancelled(sharedSignal);
      const page = await client.query(pdksBatchRefs.dates, { request, roster, cursor });
      readings.push(...page.readings);
      sourceBytes += page.sourceBytes;
      endISO = page.endISO;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    return { readings, sourceBytes, endISO };
  }, signal);
}
export async function pdksMapConcurrent<T, R>(items: readonly T[], work: (item: T, index: number) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let cursor = 0, failed = false;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    for (;;) {
      checkCancelled(signal);
      if (failed) return;
      const index = cursor++;
      if (index >= items.length) return;
      try { result[index] = await work(items[index], index); } catch (error) { failed = true; throw error; }
    }
  }));
  return result;
}
async function calculate(client: Client, request: Request, signal?: AbortSignal) {
  const roster: FunctionReturnType<BatchApi["rosterPage"]>["page"] = [];
  let cursor: string | null = null;
  for (;;) {
    checkCancelled(signal);
    const page = await client.query(pdksBatchRefs.roster, { request, cursor });
    roster.push(...page.page);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  // Legacy duplicate cards must remain together so filters and last-card-owner
  // matching keep the original full-project calculation's behavior.
  const clusters = new Map<string, typeof roster>();
  for (const employee of roster) {
    const key = employee.cardNumber ? `card:${employee.cardNumber}` : `id:${employee.employeeId}`;
    const cluster = clusters.get(key) ?? [];
    cluster.push(employee);
    clusters.set(key, cluster);
  }
  const groups: typeof roster[number]["employeeId"][][] = [];
  for (const cluster of clusters.values()) {
    const last = groups[groups.length - 1];
    if (!last || last.length + cluster.length > 20) groups.push(cluster.map(employee => employee.employeeId));
    else last.push(...cluster.map(employee => employee.employeeId));
  }
  const order = new Map(roster.map((employee, index) => [String(employee.employeeId), index]));
  groups.forEach(group => group.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)));
  const bundle = await loadPdksSource(client, request, roster, signal);
  const ids = new Set(roster.map(employee => employee.employeeId));
  const owners = new Map(roster.map(employee => [employee.cardNumber, employee.employeeId]));
  const byEmployee = new Map<typeof roster[number]["employeeId"], PdksCachedReading[]>();
  const dates = new Set<string>();
  for (const reading of bundle.readings) {
    const owner = reading.employeeId && ids.has(reading.employeeId) ? reading.employeeId : owners.get(reading.cardNo);
    if (owner) {
      const rows = byEmployee.get(owner) ?? [];
      rows.push(reading);
      byEmployee.set(owner, rows);
    } else if (reading.unassignedDate) dates.add(reading.unassignedDate);
  }
  let hasFlexible = false;
  // Adaptive splitting also handles unusually large raw device payloads.
  const part = async (employeeIds: typeof groups[number], availabilityOnly: boolean): Promise<FunctionReturnType<BatchApi["calculate"]>[]> => {
    try {
      checkCancelled(signal);
      return [await client.query(pdksBatchRefs.calculate, { request, roster, employeeIds, readings: employeeIds.flatMap(id => byEmployee.get(id) ?? []), readingEndISO: bundle.endISO, availabilityOnly,
        ...(availabilityOnly ? {} : { availableDates: [...dates], forceFlexible: hasFlexible }) })];
    } catch (error) {
      if (employeeIds.length < 2 || !isPdksBudgetError(error)) throw error;
      const selected = new Set(employeeIds);
      const units = [...clusters.values()].map(cluster => cluster.filter(employee => selected.has(employee.employeeId)).map(employee => employee.employeeId)).filter(unit => unit.length > 0);
      if (units.length < 2) throw error;
      const middle = Math.ceil(units.length / 2);
      return [...await part(units.slice(0, middle).flat(), availabilityOnly), ...await part(units.slice(middle).flat(), availabilityOnly)];
    }
  };
  const eligible = new Set<typeof roster[number]["employeeId"]>();
  const discovered = await pdksMapConcurrent(groups, group => part(group, true), signal);
  for (const results of discovered) for (const result of results) {
    result.availableDates.forEach(date => dates.add(date));
    hasFlexible ||= result.hasFlexible;
    result.eligibleEmployeeIds.forEach(id => eligible.add(id));
  }
  const rows: TableRows = [];
  const payrollRows: PayrollSheet["rows"] = [];
  let payroll: PayrollSheet | undefined;
  const calculated = await pdksMapConcurrent(groups.filter(group => group.some(id => eligible.has(id))), group => part(group, false), signal);
  for (const results of calculated) for (const result of results) {
    if (result.kind === "table") rows.push(...result.rows);
    else { payrollRows.push(...result.sheet.rows); payroll = result.sheet; }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, "tr") || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  payrollRows.sort((a, b) => a.name.localeCompare(b.name, "tr") || (order.get(a.employeeId) ?? 0) - (order.get(b.employeeId) ?? 0));
  return { rows, payroll: payroll ? { ...payroll, rows: payrollRows } : undefined };
}
export async function loadPdksTable(client: Client, args: TableArgs, signal?: AbortSignal): Promise<TableRows> {
  return (await calculate(client, { kind: "table", args }, signal)).rows;
}
export async function loadPdksPayroll(client: Client, args: PayrollArgs, signal?: AbortSignal): Promise<PayrollSheet> {
  let cursor: string | null = null;
  const rows: PayrollSheet["rows"] = [];
  let frozen: PayrollSheet | undefined;
  for (;;) {
    checkCancelled(signal);
    const page = await client.query(pdksBatchRefs.closed, { args, cursor });
    if (!page) break;
    frozen = page.sheet;
    rows.push(...page.sheet.rows);
    if (page.isDone) return { ...frozen, rows: rows.sort((a, b) => a.name.localeCompare(b.name, "tr")), ...(frozen.snapshotPending ? {} : { snapshotTruncated: false }) };
    cursor = page.continueCursor;
  }
  const result = await calculate(client, { kind: "payroll", args }, signal);
  return result.payroll ?? { days: Array.from({ length: new Date(Date.UTC(args.year, args.month, 0)).getUTCDate() }, (_, index) => `${args.year}-${String(args.month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`), rows: [], year: args.year, month: args.month, isClosed: false };
}
