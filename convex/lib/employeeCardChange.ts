import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolveEmployeeIdeDeviceIds } from "./accessGraph";

/** employees.ts update kart değişimi bloğunun (302-351) ortaklaştırılmış akışıdır. */
export async function scheduleEmployeeCardChange(
  ctx: MutationCtx,
  employeeId: Id<"employees">,
  projectId: Id<"projects"> | undefined,
  previousCardNumber: string,
): Promise<void> {
  await scheduleFingerprintPurge(ctx, employeeId, previousCardNumber);
  const ideDeviceIds = await resolveEmployeeIdeDeviceIds(ctx, employeeId, projectId);
  if (ideDeviceIds.length > 0) {
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, {
      cardNumber: previousCardNumber,
      deviceIds: ideDeviceIds,
      projectId,
    });
  }
  await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
  await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
}

/** Capture the old device identity in the same transaction as the lifecycle change. */
export async function scheduleFingerprintPurge(ctx: MutationCtx, employeeId: Id<"employees">, employeeNo: string) {
  const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(100);
  const snapshots = [];
  for (const row of rows) {
    const oldEmployeeNo = row.deletionEmployeeNo ?? employeeNo.trim();
    await ctx.db.patch(row._id, { deletionEmployeeNo: oldEmployeeNo, cancelRequested: true });
    snapshots.push({ enrollmentId: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, employeeNo: oldEmployeeNo });
  }
  if (snapshots.length) await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots });
}
