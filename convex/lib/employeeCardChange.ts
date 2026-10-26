import { snapshotEmployeeHikDevices, type HikSnapshot } from "./peopleHikSnapshot";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolveEmployeeIdeDeviceIds } from "./accessGraph";
import { assertNoEmployeeTransfer } from "./transferGuard";

/** employees.ts update kart değişimi bloğunun (302-351) ortaklaştırılmış akışıdır. */
export async function scheduleEmployeeCardChange(
  ctx: MutationCtx,
  employeeId: Id<"employees">,
  projectId: Id<"projects"> | undefined,
  previousCardNumber: string,
  previousHikSnapshot?: HikSnapshot,
): Promise<void> {
  await assertNoEmployeeTransfer(ctx, employeeId);
  await scheduleFingerprintPurge(ctx, employeeId, previousCardNumber, { deleteTemplates: false });
  const ideDeviceIds = await resolveEmployeeIdeDeviceIds(ctx, employeeId, projectId);
  if (ideDeviceIds.length > 0) {
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, {
      cardNumber: previousCardNumber,
      deviceIds: ideDeviceIds,
      projectId,
    });
  }
  const employee = await ctx.db.get(employeeId);
  const snapshot = previousHikSnapshot ?? (employee && employee.projectId === projectId ? await snapshotEmployeeHikDevices(ctx, employee) : undefined);
  if (snapshot) {
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
      employeeId, snapshot: { ...snapshot, cardNumber: previousCardNumber }, syncAfter: true,
    });
  } else {
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
  }
  await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
}

/** Capture the old device identity in the same transaction as the lifecycle change. */
export async function scheduleFingerprintPurge(ctx: MutationCtx, employeeId: Id<"employees">, employeeNo: string, options: { deleteTemplates: boolean; fingerNo?: number }) {
  if (options.deleteTemplates) {
    const templates = await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employeeId)).collect();
    for (const template of templates) {
      if (options.fingerNo === undefined || template.fingerPrintID === options.fingerNo) await ctx.db.delete(template._id);
    }
  }
  const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", employeeId)).collect();
  const snapshots = [];
  for (const row of rows) {
    if (options.fingerNo !== undefined && row.fingerNo !== options.fingerNo) continue;
    const oldEmployeeNo = row.deletionEmployeeNo ?? employeeNo.trim();
    await ctx.db.patch(row._id, { deletionEmployeeNo: oldEmployeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), cancelRequested: true });
    snapshots.push({ enrollmentId: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, employeeNo: oldEmployeeNo });
  }
  if (snapshots.length) await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots });
}
