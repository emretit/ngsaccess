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
