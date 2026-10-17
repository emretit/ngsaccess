import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** Ortak üyelik → grup cihazı yolu. Limit verilmezse silme snapshot davranışı korunur. */
export async function getEmployeeTargetDevices(
  ctx: Pick<QueryCtx, "db">,
  employee: Doc<"employees">,
  options?: { membershipLimit: number; linkLimit: number; activeOnly?: boolean },
) {
  const membershipQuery = ctx.db.query("groupMembers").withIndex("by_project_employee", q =>
    q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
  );
  const memberships = options
    ? await membershipQuery.take(options.membershipLimit)
    : await membershipQuery.collect();
  let truncated = options !== undefined && memberships.length === options.membershipLimit;
  let remainingLinks = options?.linkLimit ?? Infinity;
  const devices = new Map<string, Doc<"devices">>();
  const seenRules = new Set<string>();
  for (const membership of memberships) {
    if (seenRules.has(membership.groupId)) continue;
    seenRules.add(membership.groupId);
    if (remainingLinks === 0) { truncated = true; break; }
    const rule = await ctx.db.get(membership.groupId);
    if (!rule || rule.projectId !== employee.projectId) continue;
    if (options?.activeOnly && !rule.isActive) continue;
    const linkQuery = ctx.db.query("groupDevices").withIndex("by_project_group", q =>
      q.eq("projectId", employee.projectId).eq("groupId", rule._id),
    );
    const links = options ? await linkQuery.take(remainingLinks) : await linkQuery.collect();
    if (options && links.length === remainingLinks) truncated = true;
    remainingLinks -= links.length;
    for (const link of links) {
      if (devices.has(link.deviceId)) continue;
      const device = await ctx.db.get(link.deviceId);
      if (!device || device.projectId !== employee.projectId) continue;
      if (options?.activeOnly && !device.isActive) continue;
      devices.set(device._id, device);
    }
  }
  return { devices: [...devices.values()], truncated };
}

/** Kayıt silinmeden cihaz hedeflerini dondurur; action silinen kaydı tekrar okumaz. */
export async function snapshotEmployeeHikDevices(ctx: MutationCtx, employee: Doc<"employees">) {
  const { devices } = await getEmployeeTargetDevices(ctx, employee);
  return {
    cardNumber: employee.cardNumber,
    projectId: employee.projectId,
    devices: devices.filter(device => device.brand === "hikvision").map(device => ({
      _id: device._id, name: device.name, brand: device.brand,
      projectId: device.projectId, hikDevIndex: device.hikDevIndex,
      hikTransport: device.hikTransport, hikDoorCount: device.hikDoorCount,
    })),
  };
}
