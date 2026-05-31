import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Erişim grafı çözümleme yardımcıları (groupMembers → kural → groupDevices → cihaz).
 *
 * IDE Smart panellerinde orphan user/permission bırakmamak için, kayıt/üyelik silinmeden
 * ya da kart no değişmeden ÖNCE hangi panellerin etkilendiğini mutation içinde çözmek
 * gerekir (scheduler.runAfter commit sonrası çalıştığından bu zincir o noktada gezilemez).
 */

/** Bir çalışanın bağlı olduğu (aktif kural → aktif ide_smart cihaz) IDE panel deviceId'leri. */
export async function resolveEmployeeIdeDeviceIds(
  ctx: MutationCtx,
  employeeId: Id<"employees">,
  projectId: Id<"projects"> | undefined,
): Promise<Id<"devices">[]> {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_project_employee", (q) =>
      q.eq("projectId", projectId).eq("employeeId", employeeId),
    )
    .collect();
  const deviceIds = new Set<Id<"devices">>();
  for (const gm of memberships) {
    const rule = await ctx.db.get(gm.groupId);
    if (!rule || !rule.isActive) continue;
    await collectRuleIdeDevices(ctx, gm.groupId, projectId, deviceIds);
  }
  return Array.from(deviceIds);
}

/** Bir kuralın (grubun) bağlı olduğu IDE Smart panel deviceId'leri (kural aktif/pasif farketmez). */
export async function resolveRuleIdeDeviceIds(
  ctx: MutationCtx,
  ruleId: Id<"accessRules">,
  projectId: Id<"projects"> | undefined,
): Promise<Id<"devices">[]> {
  const deviceIds = new Set<Id<"devices">>();
  await collectRuleIdeDevices(ctx, ruleId, projectId, deviceIds);
  return Array.from(deviceIds);
}

async function collectRuleIdeDevices(
  ctx: MutationCtx,
  ruleId: Id<"accessRules">,
  projectId: Id<"projects"> | undefined,
  out: Set<Id<"devices">>,
): Promise<void> {
  const groupDevices = await ctx.db
    .query("groupDevices")
    .withIndex("by_project_group", (q) =>
      q.eq("projectId", projectId).eq("groupId", ruleId),
    )
    .collect();
  for (const gd of groupDevices) {
    const device = await ctx.db.get(gd.deviceId);
    if (device && device.isActive && device.brand === "ide_smart") out.add(device._id);
  }
}
