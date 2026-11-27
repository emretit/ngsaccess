import { patchEmployee } from "./employeeListFields";
import { snapshotEmployeeHikDevices, type HikSnapshot } from "./peopleHikSnapshot";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolveEmployeeIdeDeviceIds } from "./accessGraph";
import { assertNoEmployeeTransfer } from "./transferGuard";
import { canSyncEmployeeToDevices } from "./employeeUx";
import { hikPersonIdentity } from "./hikPersonIdentity";

/** employees.ts update kart değişimi bloğunun (302-351) ortaklaştırılmış akışıdır. */
export async function scheduleEmployeeCardChange(
  ctx: MutationCtx,
  employeeId: Id<"employees">,
  projectId: Id<"projects"> | undefined,
  previousCardNumber: string,
  previousHikSnapshot?: HikSnapshot,
): Promise<void> {
  await assertNoEmployeeTransfer(ctx, employeeId);
  const employee = await ctx.db.get(employeeId);
  if (!employee || employee.projectId !== projectId) throw new Error("Kişi bilgileri değişti");
  // The caller patches the physical card first, in the same transaction. Legacy
  // imports used their old card field as a placeholder for the device person ID.
  if (employee.hikCardless === true && employee.cardNumber === previousCardNumber) return;
  if (employee.hikEmployeeNo || employee.hikCardless === true) {
    const wasCardless = employee.hikCardless === true;
    const employeeNo = employee.hikEmployeeNo ?? previousCardNumber.trim();
    if (!employeeNo) throw new Error("Cihaz kişi kimliği bulunamadı");
    await patchEmployee(ctx, employeeId, { hikEmployeeNo: employeeNo, hikCardless: !employee.cardNumber.trim() });
    if (!wasCardless && previousCardNumber.trim() && previousCardNumber !== employee.cardNumber) {
      const snapshot = previousHikSnapshot ?? await snapshotEmployeeHikDevices(ctx, employee);
      if (snapshot.devices.some(device => device.hikTransport === "localBridge")) throw new Error("Bu cihaz köprüsünde kart değişimi desteklenmiyor; eski kart kaldırılmadan yeni kart atanamaz.");
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeCardOnlyInternal, { employeeId, cardNumber: previousCardNumber, snapshot });
    }
    // Legacy cardless imports may already exist on IDE under their placeholder.
    if (previousCardNumber.trim() && previousCardNumber !== employee.cardNumber) {
      const deviceIds = await resolveEmployeeIdeDeviceIds(ctx, employeeId, projectId);
      if (deviceIds.length) await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, { employeeId, cardNumber: previousCardNumber, deviceIds, projectId });
    }
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
    return;
  }
  // First card assignment has no old device identity to remove or purge.
  if (!canSyncEmployeeToDevices({ cardNumber: previousCardNumber })) {
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
    return;
  }
  await scheduleFingerprintPurge(ctx, employeeId, previousCardNumber, { deleteTemplates: false });
  const ideDeviceIds = await resolveEmployeeIdeDeviceIds(ctx, employeeId, projectId);
  if (ideDeviceIds.length > 0) {
    await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.deleteIdeUserFromPanels, {
      employeeId,
      cardNumber: previousCardNumber,
      deviceIds: ideDeviceIds,
      projectId,
    });
  }
  const snapshot = previousHikSnapshot ?? (employee && employee.projectId === projectId ? await snapshotEmployeeHikDevices(ctx, employee) : undefined);
  if (snapshot) {
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, {
      employeeId, snapshot: { ...snapshot, cardNumber: previousCardNumber, employeeNo: previousCardNumber }, syncAfter: true,
    });
  } else {
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId });
  }
  await ctx.scheduler.runAfter(0, internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, { employeeId });
}

/** Capture the old device identity in the same transaction as the lifecycle change. */
export async function scheduleFingerprintPurge(ctx: MutationCtx, employeeId: Id<"employees">, employeeNo: string | undefined, options: { deleteTemplates: boolean; fingerNo?: number }) {
  const employee = await ctx.db.get(employeeId);
  if (options.deleteTemplates) {
    const templates = await ctx.db.query("employeeFingerprints").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(11);
    if (templates.length > 10) throw new Error("Kişi parmak izi temizleme sınırı aşıldı");
    for (const template of templates) {
      if (options.fingerNo === undefined || template.fingerPrintID === options.fingerNo) await ctx.db.delete(template._id);
    }
  }
  const rows = await ctx.db.query("deviceFingerprintEnrollments").withIndex("by_employee", q => q.eq("employeeId", employeeId)).take(4097);
  if (rows.length > 4096) throw new Error("Kişi cihaz parmak izi sınırı aşıldı");
  const snapshots = [];
  for (const row of rows) {
    if (options.fingerNo !== undefined && row.fingerNo !== options.fingerNo) continue;
    const oldEmployeeNo = hikPersonIdentity({ hikEmployeeNo: row.deletionEmployeeNo, cardNumber: row.enrolledEmployeeNo }) ?? hikPersonIdentity({ cardNumber: employeeNo, hikEmployeeNo: employee?.hikEmployeeNo });
    if (!oldEmployeeNo?.trim()) continue;
    await ctx.db.patch(row._id, { deletionEmployeeNo: oldEmployeeNo, deletionRequestedAt: row.deletionRequestedAt ?? Date.now(), cancelRequested: true });
    snapshots.push({ enrollmentId: row._id, deviceId: row.deviceId, fingerNo: row.fingerNo, employeeNo: oldEmployeeNo });
  }
  if (snapshots.length) await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.purgeFingerprintsOnDevices, { snapshots });
}
