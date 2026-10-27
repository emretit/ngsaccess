import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export function boundedScheduleRows<T>(rows: T[], limit: number): T[] {
  if (rows.length > limit) throw new Error(`Çok büyük kapsam: en fazla ${limit} kayıt desteklenir`);
  return rows;
}
export async function scheduleRuleDevices(ctx: QueryCtx, rule: Doc<"accessRules">) {
  const links = boundedScheduleRows(await ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", rule._id)).take(201), 200);
  const doors = boundedScheduleRows(await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).take(201), 200);
  const ids = new Set(links.map(l => l.deviceId));
  for (const link of doors) {
    const door = await ctx.db.get(link.doorId);
    if (door?.projectId === rule.projectId && door?.deviceId) ids.add(door.deviceId);
  }
  const devices = await Promise.all([...ids].map(id => ctx.db.get(id)));
  return devices.filter((d): d is NonNullable<typeof d> => d !== null).filter(d => d.projectId === rule.projectId);
}
