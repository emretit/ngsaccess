import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertSameAccessProject } from "./accessScope";

export async function validateAccessRelations(
  ctx: Pick<QueryCtx, "db">,
  projectId: Id<"projects"> | undefined,
  relations: {
    employeeIds?: Id<"employees">[];
    deviceIds?: Id<"devices">[];
    doorIds?: Id<"doors">[];
  },
) {
  if (!projectId) throw new Error("Önce bir proje seçin");
  for (const id of relations.employeeIds ?? []) {
    assertSameAccessProject(projectId, await ctx.db.get(id), "Personel");
  }
  for (const id of relations.deviceIds ?? []) {
    const device = await ctx.db.get(id);
    assertSameAccessProject(projectId, device, "Cihaz");
    if (device?.doorId) assertSameAccessProject(projectId, await ctx.db.get(device.doorId), "Okuyucu kapısı");
    if (device?.zoneId) assertSameAccessProject(projectId, await ctx.db.get(device.zoneId), "Bölge");
  }
  for (const id of relations.doorIds ?? []) {
    const door = await ctx.db.get(id);
    assertSameAccessProject(projectId, door, "Kapı");
    if (door?.zoneId) assertSameAccessProject(projectId, await ctx.db.get(door.zoneId), "Bölge");
    if (door?.deviceId) assertSameAccessProject(projectId, await ctx.db.get(door.deviceId), "Kapı cihazı");
  }
}

export async function validateVisitorAccessRelations(
  ctx: Pick<QueryCtx, "db">,
  projectId: Id<"projects"> | undefined,
  ruleId: Id<"accessRules"> | undefined,
  hostEmployeeId?: Id<"employees">,
) {
  const rule = ruleId ? await ctx.db.get(ruleId) : null;
  assertSameAccessProject(projectId, rule, "Ziyaretçi kuralı");
  if (!rule || rule.targetType !== "visitor") throw new Error("Geçerli bir ziyaretçi bölgesi seçin");
  if (hostEmployeeId) assertSameAccessProject(projectId, await ctx.db.get(hostEmployeeId), "Ev sahibi personel");
  const [devices, doors] = await Promise.all([
    ctx.db.query("groupDevices").withIndex("by_group", q => q.eq("groupId", rule._id)).collect(),
    ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).collect(),
  ]);
  for (const link of [...devices, ...doors]) assertSameAccessProject(projectId, link, "Kural bağlantısı");
  await validateAccessRelations(ctx, projectId, {
    deviceIds: devices.map(d => d.deviceId), doorIds: doors.map(d => d.doorId),
  });
}

export async function validateRuleAccessRelations(
  ctx: Pick<QueryCtx, "db">,
  rule: { _id: Id<"accessRules">; projectId?: Id<"projects">; targetType?: string },
  replacements: { employeeIds?: Id<"employees">[]; deviceIds?: Id<"devices">[]; doorIds?: Id<"doors">[] } = {},
) {
  const [members, devices, doors] = await Promise.all([
    ctx.db.query("groupMembers").withIndex("by_group", q => q.eq("groupId", rule._id)).collect(),
    ctx.db.query("groupDevices").withIndex("by_group", q => q.eq("groupId", rule._id)).collect(),
    ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).collect(),
  ]);
  await validateAccessRelations(ctx, rule.projectId, {
    employeeIds: rule.targetType === "visitor" ? members.map(m => m.employeeId) : replacements.employeeIds ?? members.map(m => m.employeeId),
    deviceIds: replacements.deviceIds ?? devices.map(d => d.deviceId),
    doorIds: replacements.doorIds ?? doors.map(d => d.doorId),
  });
}
