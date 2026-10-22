import { expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { runBackfillDeviceFromGroups } from "./gatewayBackfill";

vi.mock("./hikGateway", () => ({ searchAcsEventsOnDevice: vi.fn() }));
vi.mock("./gatewayCommand", () => ({ auditDeviceCommand: vi.fn() }));
it("schedules cleanup only after registration backfill plans and people finish", async () => {
  const runQuery = vi.fn(async () => ({ employeeIds: ["employee"], accessRuleIds: ["rule"] }));
  const order: string[] = [];
  const runAction = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => { order.push(getFunctionName(ref)); });
  const runAfter = vi.fn(async (_delay: number, ref: Parameters<typeof getFunctionName>[0], args: object) => { order.push(getFunctionName(ref)); expect(args).toEqual({ deviceId: "device", dryRun: false, reason: "register" }); });
  const ctx = { runQuery, runAction, scheduler: { runAfter } } as unknown as ActionCtx;
  expect(await runBackfillDeviceFromGroups(ctx, { deviceId: "device" as Id<"devices"> })).toEqual({ employees: 1, rules: 1 });
  expect(order).toEqual(["actions/hikvisionSync:syncWeekPlanToDevicesInternal", "actions/hikvisionSync:syncEmployeeToDevicesInternal", "actions/hikRosterReconcile:reconcileHikDeviceRoster"]);
});
it("still schedules the safety check when the new registration has no groups", async () => {
  const runAfter = vi.fn();
  const ctx = { runQuery: async () => ({ employeeIds: [], accessRuleIds: [] }), runAction: vi.fn(), scheduler: { runAfter } } as unknown as ActionCtx;
  await runBackfillDeviceFromGroups(ctx, { deviceId: "device" as Id<"devices"> });
  expect(runAfter).toHaveBeenCalledTimes(1);
});
