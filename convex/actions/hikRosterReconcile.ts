"use node";

import { v } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { searchPersonOnDevice, deletePersonFromDevice } from "../lib/gateway/persons";
import { planHikRosterReconcile } from "../lib/hikRosterReconcile";

type Roster = FunctionReturnType<typeof internal.hikRosterReconcile.getExpectedRoster>;
type Result = { onDevice: number; expected: number; extra: number; deleted: number; failed: number; skippedReason?: string };
const DELETE_LIMIT = 500;
const PAGE_LIMIT = 1000;
const RETRY_DELAYS = [1, 5, 15, 30, 60].map(minutes => minutes * 60_000);
const REFRESH_INTERVAL = 25;

export const reconcileHikDeviceRoster = internalAction({
  args: {
    deviceId: v.id("devices"),
    dryRun: v.boolean(),
    reason: v.union(v.literal("register"), v.literal("manual")),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Result> => {
    const result: Result = { onDevice: 0, expected: 0, extra: 0, deleted: 0, failed: 0 };
    const allowEmptyExpected = args.reason === "register";
    const finish = async (skippedReason?: string): Promise<Result> => {
      if (!args.dryRun && args.reason === "register" &&
          (skippedReason === "device_roster_unavailable" || skippedReason === "incomplete_device_roster" ||
           (!skippedReason && result.failed > 0))) {
        const attempt = args.attempt ?? 0;
        const delay = RETRY_DELAYS[attempt];
        if (delay !== undefined) {
          await ctx.scheduler.runAfter(delay, internal.actions.hikRosterReconcile.reconcileHikDeviceRoster, {
            ...args, attempt: attempt + 1,
          });
        } else {
          await ctx.runMutation(internal.hikRosterReconcile.markReconcilePending, {
            deviceId: args.deviceId,
            hint: "Cihazdaki eski kişiler temizlenemedi (cihaz çevrimdışı). Cihaz çevrimiçi olunca destekle iletişime geçin.",
          });
        }
      }
      if (skippedReason) result.skippedReason = skippedReason;
      console.log(JSON.stringify({ event: "hikRosterReconcile", deviceId: args.deviceId, dryRun: args.dryRun, reason: args.reason, attempt: args.attempt ?? 0, ...result }));
      return result;
    };
    let roster: Roster;
    try {
      roster = await ctx.runQuery(internal.hikRosterReconcile.getExpectedRoster, { deviceId: args.deviceId });
    } catch { return finish("expected_unavailable"); }
    if (roster.employeeNos === null || !roster.device?.hikDevIndex) return finish(roster.skippedReason ?? "expected_unavailable");
    const device = roster.device;
    const devIndex = device.hikDevIndex;
    if (!devIndex) return finish("unsupported_device");
    result.expected = roster.employeeNos.length;
    const persons: string[] = [];
    const searchID = crypto.randomUUID();
    let position = 0;
    let total = 0;
    let complete = false;
    // Read the entire device snapshot before deleting: deletion changes page offsets.
    try {
      for (let pageNo = 0; pageNo < PAGE_LIMIT; pageNo++) {
        const page = await searchPersonOnDevice(devIndex, { searchID, searchResultPosition: position, maxResults: 30 });
        if (!page.ok || !Array.isArray(page.persons)) return finish("device_roster_unavailable");
        if (page.persons.some(person => typeof person.employeeNo !== "string" || !person.employeeNo.trim())) return finish("invalid_device_identity");
        persons.push(...page.persons.map(person => person.employeeNo));
        result.onDevice = new Set(persons).size;
        if (page.total !== undefined) {
          if (!Number.isSafeInteger(page.total) || page.total < 0) return finish("invalid_device_total");
          total = Math.max(total, page.total);
        }
        if (page.persons.length === 0) {
          // HTTP 200 can still contain a gateway error, with no roster total.
          if (page.total === undefined) return finish("device_roster_unavailable");
          if (persons.length < total) return finish("incomplete_device_roster");
          complete = true;
          break;
        }
        if (page.nextPosition !== position + page.persons.length) return finish("invalid_device_pagination");
        position = page.nextPosition;
      }
    } catch { return finish("device_roster_unavailable"); }
    if (!complete) return finish("device_roster_limit");
    // Refresh after the network scan. Never apply an old project's roster to a
    // device whose assignment or gateway registration changed in the meantime.
    const refresh = async (): Promise<string | undefined> => {
      try {
        roster = await ctx.runQuery(internal.hikRosterReconcile.getExpectedRoster, { deviceId: args.deviceId });
      } catch { return "expected_unavailable"; }
      if (roster.employeeNos === null) return roster.skippedReason ?? "expected_unavailable";
      if (roster.device?.projectId !== device.projectId || roster.device.hikDevIndex !== devIndex) return "device_changed";
      result.expected = roster.employeeNos.length;
      return undefined;
    };
    const refreshError = await refresh();
    if (refreshError) return finish(refreshError);
    const plan = planHikRosterReconcile(persons, roster.employeeNos === null ? null : new Set(roster.employeeNos), allowEmptyExpected);
    if (!plan.safe) return finish(plan.skippedReason);
    result.extra = plan.toDelete.length;
    if (args.dryRun) return finish();
    let checked = 0;
    for (const employeeNo of plan.toDelete.slice(0, DELETE_LIMIT)) {
      // The post-scan refresh covers the first batch; refresh rights every 25 candidates.
      if (checked > 0 && checked % REFRESH_INTERVAL === 0) {
        const error = await refresh();
        if (error) return finish(error);
      }
      checked++;
      // Keep the lightweight assignment/registration check before every deletion.
      const currentDevice = await ctx.runQuery(internal.devices.getByIdInternal, { id: args.deviceId });
      if (!currentDevice || currentDevice.projectId !== device.projectId || currentDevice.hikDevIndex !== devIndex) {
        return finish("device_changed");
      }
      if (currentDevice.brand !== "hikvision" || currentDevice.hikTransport !== "gateway") return finish("unsupported_device");
      if (!currentDevice.isActive) return finish("device_scope_unavailable");
      const current = planHikRosterReconcile([employeeNo], roster.employeeNos === null ? null : new Set(roster.employeeNos), allowEmptyExpected);
      if (!current.safe) return finish(current.skippedReason);
      if (!current.toDelete.length) continue;
      try {
        const deletion = await deletePersonFromDevice(devIndex, employeeNo);
        if (deletion.ok) result.deleted++;
        else result.failed++;
      } catch { result.failed++; }
    }
    // Registration failures use the bounded retry chain in finish, never both
    // that chain and a 500-person continuation. Manual behavior stays unchanged.
    if (plan.toDelete.length > DELETE_LIMIT && result.deleted > 0 &&
        !(args.reason === "register" && result.failed > 0)) {
      await ctx.scheduler.runAfter(1000, internal.actions.hikRosterReconcile.reconcileHikDeviceRoster, args);
    }
    return finish();
  },
});
