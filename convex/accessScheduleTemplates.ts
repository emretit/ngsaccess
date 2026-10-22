import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import { effectiveSchedule, normalizeWeek, toIdePermissionSegments, WEEKDAYS, type WeekSchedule } from "./lib/accessSchedule";

const interval = v.object({ start: v.string(), end: v.string() });
export const weekValidator = v.object({ Monday: v.array(interval), Tuesday: v.array(interval), Wednesday: v.array(interval), Thursday: v.array(interval), Friday: v.array(interval), Saturday: v.array(interval), Sunday: v.array(interval) });
export function boundedScheduleRows<T>(rows: T[], limit: number): T[] {
  if (rows.length > limit) throw new Error(`Çok büyük kapsam: en fazla ${limit} kayıt desteklenir`);
  return rows;
}
export async function readTemplate(ctx: QueryCtx, templateId: Id<"accessScheduleTemplates">) {
  const template = await ctx.db.get(templateId);
  if (!template) throw new Error("Şablon bulunamadı");
  await resolveProjectScope(ctx, template.projectId);
  return template;
}
export async function templateRules(ctx: QueryCtx, templateId: Id<"accessScheduleTemplates">) {
  return boundedScheduleRows(await ctx.db.query("accessRules").withIndex("by_template", q => q.eq("scheduleTemplateId", templateId)).take(101), 100);
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
/** Bounded whole-project accounting, including door-only grants and every other rule. */
export async function ideScheduleImpact(ctx: QueryCtx, projectId: Id<"projects">, replacement?: { templateId: Id<"accessScheduleTemplates">; week: WeekSchedule }, affectedRuleIds?: readonly Id<"accessRules">[], targetDeviceId?: Id<"devices">) {
  if (affectedRuleIds?.length === 0) return [];
  const affected = new Set<string>();
  const rules = boundedScheduleRows(await ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", projectId)).take(101), 100);
  const totals = new Map<string, { employeeId: Id<"employees">; deviceId: Id<"devices">; total: number }>();
  let read = 0;
  const templates = new Map<Id<"accessScheduleTemplates">, Doc<"accessScheduleTemplates"> | null>();
  for (const rule of rules) {
    if (rule.isActive === false) continue;
    let template = null;
    if (rule.scheduleTemplateId) {
      if (!templates.has(rule.scheduleTemplateId)) templates.set(rule.scheduleTemplateId, await ctx.db.get(rule.scheduleTemplateId));
      template = templates.get(rule.scheduleTemplateId) ?? null;
    }
    const week = replacement && rule.scheduleTemplateId === replacement.templateId ? replacement.week : effectiveSchedule(rule, template);
    const k = rule.scheduleTemplateId ? toIdePermissionSegments(week).length : 1;
    const panels = (await scheduleRuleDevices(ctx, rule)).filter(d => d.brand === "ide_smart" && d.isActive !== false);
    if (!panels.length) continue;
    const members = boundedScheduleRows(await ctx.db.query("groupMembers").withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", rule._id)).take(501), 500);
    read += members.length + panels.length;
    if (read > 5000) throw new Error("Çok büyük kapsam: izin hesabı 5000 ilişkiyi aşıyor");
    for (const employeeId of new Set(members.map(m => m.employeeId))) for (const panel of panels) {
      const key = `${employeeId}/${panel._id}`;
      if ((replacement ? rule.scheduleTemplateId === replacement.templateId : affectedRuleIds ? affectedRuleIds.includes(rule._id) : true)
        && (!targetDeviceId || panel._id === targetDeviceId)) affected.add(key);
      const entry = totals.get(key) ?? { employeeId, deviceId: panel._id, total: 0 };
      entry.total += k;
      totals.set(key, entry);
      if (totals.size > 5000) throw new Error("Çok büyük kapsam: izin hesabı 5000 kişi/paneli aşıyor");
    }
  }
  return [...totals.values()].filter(e => e.total > 16 && affected.has(`${e.employeeId}/${e.deviceId}`));
}
export async function assertIdeScheduleCapacity(ctx: QueryCtx, projectId: Id<"projects">, replacement?: { templateId: Id<"accessScheduleTemplates">; week: WeekSchedule }, affectedRuleIds?: readonly Id<"accessRules">[], targetDeviceId?: Id<"devices">) {
  const over = await ideScheduleImpact(ctx, projectId, replacement, affectedRuleIds, targetDeviceId);
  if (!over.length) return;
  const labels = await Promise.all(over.slice(0, 5).map(async e => {
    const employee = await ctx.db.get(e.employeeId);
    const device = await ctx.db.get(e.deviceId);
    return `${employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmeyen kişi"} / ${device?.name ?? "Bilinmeyen cihaz"}: ${e.total}`;
  }));
  throw new Error(`IDE izin sınırı (16) aşılıyor: ${labels.join("; ")}`);
}
export async function validateScheduleBinding(ctx: MutationCtx & { user: Doc<"users"> }, projectId: Id<"projects">, templateId: Id<"accessScheduleTemplates"> | null | undefined, previous?: Id<"accessScheduleTemplates">) {
  if (templateId === undefined) return;
  if (ctx.user.role !== "super_admin" && ctx.user.role !== "project_admin") throw new Error("Bu işlem için yetkiniz yok");
  if (templateId === null) return;
  const template = await ctx.db.get(templateId);
  if (!template || template.projectId !== projectId) throw new Error("Şablon bu projeye ait değil");
  if (template.isArchived && templateId !== previous) throw new Error("Arşivli şablona yeni kural bağlanamaz");
}
async function uniqueName(ctx: QueryCtx, projectId: Id<"projects">, raw: string, except?: Id<"accessScheduleTemplates">) {
  const name = raw.trim();
  if (!name) throw new Error("Şablon adı zorunludur");
  const existing = await ctx.db.query("accessScheduleTemplates").withIndex("by_project_name", q => q.eq("projectId", projectId).eq("name", name)).first();
  if (existing && existing._id !== except) throw new Error("Bu projede aynı adlı bir şablon var");
  return name;
}
export const list = authedQuery({
  args: { projectId: v.id("projects"), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const rows = boundedScheduleRows(await ctx.db.query("accessScheduleTemplates").withIndex("by_project", q => q.eq("projectId", args.projectId)).take(201), 200);
    return await Promise.all(rows.filter(t => args.includeArchived || !t.isArchived).map(async t => ({ ...t, ruleCount: (await templateRules(ctx, t._id)).length })));
  },
});
export const get = authedQuery({ args: { templateId: v.id("accessScheduleTemplates") }, handler: readTemplateArg });
async function readTemplateArg(ctx: QueryCtx, args: { templateId: Id<"accessScheduleTemplates"> }) { return await readTemplate(ctx, args.templateId); }
export const create = adminMutation({
  args: { projectId: v.id("projects"), name: v.string(), description: v.optional(v.string()), week: weekValidator },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const name = await uniqueName(ctx, args.projectId, args.name);
    const week = normalizeWeek(args.week);
    toIdePermissionSegments(week);
    await assertIdeScheduleCapacity(ctx, args.projectId, undefined, []);
    const now = new Date().toISOString();
    return await ctx.db.insert("accessScheduleTemplates", { ...args, name, week, version: 1, createdAt: now, updatedAt: now });
  },
});
export const update = adminMutation({
  args: { templateId: v.id("accessScheduleTemplates"), name: v.optional(v.string()), description: v.optional(v.union(v.string(), v.null())), week: v.optional(weekValidator) },
  handler: async (ctx, args) => {
    const template = await readTemplate(ctx, args.templateId);
    const week = normalizeWeek(args.week ?? template.week);
    toIdePermissionSegments(week);
    await templateRules(ctx, template._id);
    await assertIdeScheduleCapacity(ctx, template.projectId, { templateId: template._id, week });
    const name = await uniqueName(ctx, template.projectId, args.name ?? template.name, template._id);
    let pendingSyncJobId = template.pendingSyncJobId;
    if (JSON.stringify(week) !== JSON.stringify(normalizeWeek(template.week))) {
      if (pendingSyncJobId) await ctx.scheduler.cancel(pendingSyncJobId);
      pendingSyncJobId = await ctx.scheduler.runAfter(20_000, internal.deviceSyncRuns.createTemplateRun, { templateId: template._id, startedBy: ctx.user._id });
    }
    await ctx.db.patch(template._id, { name, description: args.description === undefined ? template.description : args.description?.trim() || undefined, week, version: template.version + 1, updatedAt: new Date().toISOString(), pendingSyncJobId });
    return template._id;
  },
});
export const duplicate = adminMutation({
  args: { templateId: v.id("accessScheduleTemplates"), name: v.string() },
  handler: async (ctx, args) => {
    const template = await readTemplate(ctx, args.templateId);
    const name = await uniqueName(ctx, template.projectId, args.name);
    const now = new Date().toISOString();
    return await ctx.db.insert("accessScheduleTemplates", { projectId: template.projectId, name, description: template.description, week: template.week, version: 1, createdAt: now, updatedAt: now });
  },
});
export const setArchived = adminMutation({
  args: { templateId: v.id("accessScheduleTemplates"), isArchived: v.boolean() },
  handler: async (ctx, args) => {
    const template = await readTemplate(ctx, args.templateId);
    await ctx.db.patch(template._id, { isArchived: args.isArchived, updatedAt: new Date().toISOString() });
    return template._id;
  },
});
export const remove = adminMutation({
  args: { templateId: v.id("accessScheduleTemplates") },
  handler: async (ctx, args) => {
    const template = await readTemplate(ctx, args.templateId);
    const rules = await templateRules(ctx, template._id);
    if (rules.length) throw new Error(`${rules.length} kural kullanıyor`);
    if (template.pendingSyncJobId) await ctx.scheduler.cancel(template.pendingSyncJobId);
    await ctx.db.delete(template._id);
    return null;
  },
});
export const previewImpact = authedQuery({
  args: { templateId: v.id("accessScheduleTemplates"), week: v.optional(weekValidator) },
  handler: async (ctx, args) => {
    const template = await readTemplate(ctx, args.templateId);
    const week = normalizeWeek(args.week ?? template.week);
    const rules = await templateRules(ctx, template._id);
    const devices = new Set<Id<"devices">>();
    for (const rule of rules) for (const device of await scheduleRuleDevices(ctx, rule)) devices.add(device._id);
    const ideOverLimit = await Promise.all((await ideScheduleImpact(ctx, template.projectId, { templateId: template._id, week })).slice(0, 20).map(async entry => {
      const employee = await ctx.db.get(entry.employeeId);
      const device = await ctx.db.get(entry.deviceId);
      return { ...entry, employeeName: employee ? `${employee.firstName} ${employee.lastName}` : "Bilinmeyen kişi", deviceName: device?.name ?? "Bilinmeyen cihaz" };
    }));
    return { ruleCount: rules.length, deviceCount: devices.size, hikMaxSegmentsPerDay: Math.max(...WEEKDAYS.map(d => week[d].length)), ideRecordCount: toIdePermissionSegments(week).length,
      ideOverLimit };
  },
});
