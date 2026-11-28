import { useTabVisible } from "./useVisibleRefresh";
import { trTodayKey } from "../../convex/lib/trDate";
import { useEffect, useMemo, useState } from "react";
import { useQueries } from "convex/react";
import { getFunctionName, makeFunctionReference, type FunctionArgs, type FunctionReturnType } from "convex/server";
import { pdksBatchRefs, type TableArgs, type TableRows } from "@/lib/pdksBatches";
import { invalidatePdksSnapshots } from "@/lib/pdksInvalidation";
import { isPdksBudgetError, pdksErrorMessage } from "@/lib/pdksErrors";
import type { Value } from "convex/values";

// Convex useQueries updates state during render when the request object changes.
// Stabilize by value, including empty/skipped requests and newly assembled rosters.
function useStableQueries(requests: Parameters<typeof useQueries>[0]) {
  const key = JSON.stringify(Object.entries(requests).map(([id, { query, args }]) => [id, getFunctionName(query), args]));
  const stable = useMemo(() => {
    const entries = JSON.parse(key) as [string, string, Record<string, Value>][];
    return Object.fromEntries(entries.map(([id, name, args]) => [id, { query: makeFunctionReference<"query">(name), args }]));
  }, [key]);
  return useQueries(stable);
}

type Result = FunctionReturnType<typeof pdksBatchRefs.calculate>;
type Roster = FunctionReturnType<typeof pdksBatchRefs.todayRoster>;
type Requests = Record<string, { query: typeof pdksBatchRefs.calculate; args: FunctionArgs<typeof pdksBatchRefs.calculate> }>;

export const PDKS_HIDDEN_DELAY_MS = 30_000;

/** Bounded group subscriptions: one new badge event recomputes its group, not the full report. */
export function usePdksLiveTable(input: TableArgs | "skip") {
  const isVisible = useTabVisible(PDKS_HIDDEN_DELAY_MS);
  const args = isVisible ? input : "skip";
  const key = JSON.stringify(input);
  const [splits, setSplits] = useState<{ key: string; ids: string[] }>({ key, ids: [] });
  const splitIds = useMemo(() => splits.key === key ? splits.ids : [], [splits, key]);
  const date = args === "skip" ? "" : args.startDate ?? args.date ?? trTodayKey();
  const rosterResult = (useStableQueries(args === "skip" ? {} : { roster: { query: pdksBatchRefs.todayRoster, args: { projectId: args.projectId, date } } }) as Record<string, Roster | Error | undefined>).roster;
  const roster = rosterResult instanceof Error ? undefined : rosterResult;
  const unknownResult = (useStableQueries(args === "skip" || !roster ? {} : { dates: { query: pdksBatchRefs.todayAvailability, args: { projectId: args.projectId, date, roster } } }) as Record<string, FunctionReturnType<typeof pdksBatchRefs.todayAvailability> | Error | undefined>).dates;
  const unknownDates = unknownResult instanceof Error ? undefined : unknownResult;
  const deviceResult = (useStableQueries(args === "skip" ? {} : { devices: { query: pdksBatchRefs.todayDeviceAvailability, args: { projectId: args.projectId } } }) as Record<string, FunctionReturnType<typeof pdksBatchRefs.todayDeviceAvailability> | Error | undefined>).devices;
  const deviceAvailability = deviceResult instanceof Error ? undefined : deviceResult;
  const groups = useMemo(() => {
    const clusters = new Map<string, Roster>();
    for (const employee of roster ?? []) {
      const id = employee.cardNumber ? `card:${employee.cardNumber}` : `id:${employee.employeeId}`;
      const cluster = clusters.get(id) ?? []; cluster.push(employee); clusters.set(id, cluster);
    }
    const result: Roster[] = [];
    for (const cluster of clusters.values()) {
      const last = result[result.length - 1];
      if (!last || last.length + cluster.length > 64) result.push([...cluster]);
      else last.push(...cluster);
    }
    const divide = (group: Roster): Roster[] => {
      if (group.length < 2 || !splitIds.includes(group.map(employee => employee.employeeId).join(","))) return [group];
      const middle = Math.ceil(group.length / 2);
      return [...divide(group.slice(0, middle)), ...divide(group.slice(middle))];
    };
    return result.flatMap(divide);
  }, [roster, splitIds]);
  const groupKey = (group: Roster) => group.map(employee => employee.employeeId).join(",");
  const request = (availabilityOnly: boolean, availableDates?: string[], forceFlexible?: boolean): Requests => {
    if (args === "skip" || !roster) return {};
    return Object.fromEntries(groups.map(group => [groupKey(group), { query: pdksBatchRefs.calculate, args: {
      request: { kind: "table", args }, roster, employeeIds: group.map(employee => employee.employeeId), availabilityOnly,
      ...(!availabilityOnly ? { deviceAvailability } : {}),
      ...(availableDates ? { availableDates, forceFlexible } : {}),
    } }]));
  };
  const discovery = useStableQueries(request(true)) as Record<string, Result | Error | undefined>;
  const ready = args !== "skip" && roster !== undefined && unknownDates !== undefined && deviceAvailability !== undefined && groups.every(group => discovery[groupKey(group)] && !(discovery[groupKey(group)] instanceof Error));
  const dates = new Set(unknownDates ?? []);
  let flexible = false;
  for (const result of Object.values(discovery)) if (result && !(result instanceof Error)) {
    result.availableDates.forEach(date => dates.add(date)); flexible ||= result.hasFlexible;
  }
  const results = useStableQueries(ready ? request(false, [...dates].sort(), flexible) : {}) as Record<string, Result | Error | undefined>;
  const failures = [rosterResult, unknownResult, deviceResult, ...Object.values(discovery), ...Object.values(results)].filter((result): result is Error => result instanceof Error);
  const failedGroups = groups.filter(group => group.length > 1 && [discovery[groupKey(group)], results[groupKey(group)]].some(result => result instanceof Error && isPdksBudgetError(result)));
  const failedKeys = failedGroups.map(groupKey).join(";");
  useEffect(() => {
    if (failedKeys) setSplits(previous => ({ key, ids: [...new Set([...(previous.key === key ? previous.ids : []), ...failedKeys.split(";")])] }));
  }, [failedKeys, key]);
  const complete = ready && groups.every(group => results[groupKey(group)] && !(results[groupKey(group)] instanceof Error));
  let data: TableRows | undefined;
  if (complete) {
    const order = new Map<string, number>((roster ?? []).map((employee, i) => [employee.employeeId, i]));
    data = Object.values(results).flatMap(result => result && !(result instanceof Error) && result.kind === "table" ? result.rows : [])
      .sort((a, b) => a.name.localeCompare(b.name, "tr") || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  const signature = data ? JSON.stringify(data) : undefined;
  const [last, setLast] = useState<{ key: string; data?: TableRows; updatedAt?: number }>({ key });
  useEffect(() => {
    if (signature !== undefined) setLast({ key, data: JSON.parse(signature) as TableRows, updatedAt: Date.now() });
  }, [signature, key]);
  const cached = last.key === key && input !== "skip" ? last : undefined;
  const error = [rosterResult, unknownResult, deviceResult].find((value): value is Error => value instanceof Error)
    ?? failures.find(failure => !isPdksBudgetError(failure)) ?? groups.flatMap(group => group.length === 1 ? [discovery[groupKey(group)], results[groupKey(group)]] : []).find((value): value is Error => value instanceof Error);
  const completedGroups = Object.values(results).filter(result => result && !(result instanceof Error)).length;
  return { data: data ?? cached?.data, error: error ? pdksErrorMessage(error) : undefined, updatedAt: cached?.updatedAt, refreshing: !complete, refresh: invalidatePdksSnapshots, availabilityUnknown: unknownResult === null,
    progress: `${completedGroups}/${groups.length} grup` };
}
