import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** Kayıt silinmeden cihaz hedeflerini dondurur; action silinen kaydı tekrar okumaz. */
export async function snapshotEmployeeHikDevices(ctx: MutationCtx, employee: Doc<"employees">) {
  const memberships = await ctx.db.query("groupMembers").withIndex("by_project_employee", q =>
    q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
  ).collect();
  const devices = new Map<string, Doc<"devices">>();
  for (const membership of memberships) {
    const rule = await ctx.db.get(membership.groupId);
    if (!rule || rule.projectId !== employee.projectId) continue;
    const links = await ctx.db.query("groupDevices").withIndex("by_project_group", q =>
      q.eq("projectId", employee.projectId).eq("groupId", rule._id),
    ).collect();
    for (const link of links) {
      const device = await ctx.db.get(link.deviceId);
      if (device?.brand === "hikvision" && device.projectId === employee.projectId) devices.set(device._id, device);
    }
  }
  return {
    cardNumber: employee.cardNumber,
    projectId: employee.projectId,
    devices: [...devices.values()].map(device => ({
      _id: device._id, name: device.name, brand: device.brand,
      projectId: device.projectId, hikDevIndex: device.hikDevIndex,
      hikTransport: device.hikTransport, hikDoorCount: device.hikDoorCount,
    })),
  };
}
