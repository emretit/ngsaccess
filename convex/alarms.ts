import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { v } from "convex/values";
import { adminMutation, adminQuery, authedQuery } from "./lib/customFunctions";
import { internalQuery } from "./_generated/server";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { writeAudit } from "./lib/audit";

const category = v.union(v.literal("alarm"), v.literal("exception"));
const severity = v.union(v.literal("info"), v.literal("warning"), v.literal("critical"));
const status = v.union(v.literal("open"), v.literal("acked"), v.literal("all"));

export const list = authedQuery({
  args: { projectId: v.id("projects"), category, status, severity: v.optional(severity), deviceId: v.optional(v.id("devices")), from: v.optional(v.string()), to: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    if (!isProjectAllowed(await getProjectIdsForUser(ctx), args.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1) throw new Error("Sayfa boyutu pozitif bir tam sayı olmalı");
    const fromTime = args.from ? Date.parse(args.from) : undefined;
    const toTime = args.to ? Date.parse(args.to) : undefined;
    if ((args.from && (args.from.length > 40 || !Number.isFinite(fromTime))) || (args.to && (args.to.length > 40 || !Number.isFinite(toTime))) || (fromTime !== undefined && toTime !== undefined && fromTime > toTime)) throw new Error("Geçerli bir tarih aralığı girin");
    const from = args.from ? new Date(fromTime ?? 0).toISOString() : undefined;
    const to = args.to ? new Date(toTime ?? 0).toISOString() : undefined;
    if (args.deviceId) {
      const device = await ctx.db.get(args.deviceId);
      if (device?.projectId !== args.projectId) throw new Error("Cihaz seçili projede bulunamadı");
    }
    const indexed = stream(ctx.db, schema).query("deviceEvents").withIndex("by_project_category_event_time", q => {
      const prefix = q.eq("projectId", args.projectId).eq("category", args.category);
      return from ? prefix.gte("eventTime", from) : prefix;
    }).order("desc");
    let scannedCount = 0;
    const result = await indexed.filterWith(async event => {
      scannedCount += 1;
      return (to === undefined || event.eventTime <= to)
        && (args.deviceId === undefined || event.deviceId === args.deviceId)
        && (args.severity === undefined || event.severity === args.severity)
        && (args.status === "all" || (args.status === "acked" ? event.ackedAt !== undefined : event.ackedAt === undefined));
    }).paginate({ ...args.paginationOpts, numItems: Math.min(100, Math.max(1, Math.floor(args.paginationOpts.numItems))), maximumRowsRead: 2000, maximumBytesRead: 2_000_000 });
    const deviceIds = [...new Set(result.page.flatMap(event => event.deviceId ? [event.deviceId] : []))];
    const devices = (await Promise.all(deviceIds.map(id => ctx.db.get(id)))).filter((device): device is NonNullable<typeof device> => device !== null);
    const deviceMap = new Map(devices.map(device => [device._id, device]));
    return { ...result, page: result.page.map(event => ({ ...event, deviceName: event.deviceId ? deviceMap.get(event.deviceId)?.name ?? "Cihaz bulunamadı" : "—" })), scannedCount, scanLimitReached: result.pageStatus === "SplitRequired" };
  },
});

export const summary = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    if (!isProjectAllowed(await getProjectIdsForUser(ctx), args.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    const from = new Date(Date.now() - 7 * 86400000).toISOString();
    const batches = await Promise.all(([
      ctx.db.query("deviceEvents").withIndex("by_project_category_event_time", q => q.eq("projectId", args.projectId).eq("category", "alarm").gte("eventTime", from)).take(200),
      ctx.db.query("deviceEvents").withIndex("by_project_category_event_time", q => q.eq("projectId", args.projectId).eq("category", "exception").gte("eventTime", from)).take(200),
    ]));
    const records = batches.flat();
    const open = records.filter(event => !event.ackedAt);
    return { critical: open.filter(event => event.severity === "critical").length, warning: open.filter(event => event.severity === "warning").length, capped: batches.some(batch => batch.length === 200) };
  },
});

export const acknowledge = adminMutation({
  args: { ids: v.array(v.id("deviceEvents")), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.ids.length < 1 || args.ids.length > 50) throw new Error("En fazla 50 olay seçilebilir");
    if ((args.note?.length ?? 0) > 200) throw new Error("Not en fazla 200 karakter olabilir");
    const allowed = await getProjectIdsForUser(ctx); const now = new Date().toISOString();
    let acknowledged = 0;
    for (const id of [...new Set(args.ids)]) {
      const event = await ctx.db.get(id);
      if (!event || !event.projectId || !isProjectAllowed(allowed, event.projectId)) throw new Error("Olay bulunamadı veya erişim yetkiniz yok");
      if (event.category !== "alarm" && event.category !== "exception") throw new Error("Yalnızca alarm ve istisna olayları onaylanabilir");
      if (event.ackedAt) continue;
      await ctx.db.patch(id, { ackedAt: now, ackedBy: ctx.user._id, ackNote: args.note?.trim() || undefined, updatedAt: now });
      await writeAudit(ctx, { user: ctx.user, projectId: event.projectId, action: "update", targetTable: "deviceEvents", targetId: id, oldValue: { ackedAt: null }, newValue: { ackedAt: now }, note: args.note?.trim() });
      acknowledged += 1;
    }
    return { acknowledged };
  },
});

export const getSettings = adminQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    if (!isProjectAllowed(await getProjectIdsForUser(ctx), args.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    return await ctx.db.query("alarmSettings").withIndex("by_project", q => q.eq("projectId", args.projectId)).unique() ?? { projectId: args.projectId, emailEnabled: false, recipients: [], minSeverity: "warning" as const };
  },
});

export const saveSettings = adminMutation({
  args: { projectId: v.id("projects"), emailEnabled: v.boolean(), recipients: v.array(v.string()), minSeverity: v.union(v.literal("warning"), v.literal("critical")) },
  handler: async (ctx, args) => {
    if (!isProjectAllowed(await getProjectIdsForUser(ctx), args.projectId)) throw new Error("Bu projeye erişim yetkiniz yok");
    const recipients = [...new Set(args.recipients.map(email => email.trim().toLowerCase()).filter(Boolean))];
    if (args.recipients.length > 8 || args.recipients.some(email => email.length > 254) || recipients.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("En fazla 8 geçerli e-posta adresi girin");
    const existing = await ctx.db.query("alarmSettings").withIndex("by_project", q => q.eq("projectId", args.projectId)).unique();
    const values = { emailEnabled: args.emailEnabled, recipients, minSeverity: args.minSeverity, updatedBy: ctx.user._id, updatedAt: new Date().toISOString() };
    if (existing) await ctx.db.patch(existing._id, values); else await ctx.db.insert("alarmSettings", { projectId: args.projectId, ...values });
    await writeAudit(ctx, { user: ctx.user, projectId: args.projectId, action: existing ? "update" : "create", targetTable: "alarmSettings", targetId: existing?._id ?? args.projectId, oldValue: existing ? { emailEnabled: existing.emailEnabled, minSeverity: existing.minSeverity, recipientCount: existing.recipients.length } : undefined, newValue: { emailEnabled: args.emailEnabled, minSeverity: args.minSeverity, recipientCount: recipients.length } });
    return { success: true };
  },
});

export const emailPayload = internalQuery({
  args: { eventId: v.id("deviceEvents") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event?.projectId || !event.deviceId) return null;
    const projectId = event.projectId;
    const deviceId = event.deviceId;
    const settings = await ctx.db.query("alarmSettings").withIndex("by_project", q => q.eq("projectId", projectId)).unique();
    if (!settings?.emailEnabled || settings.recipients.length === 0 || !["alarm", "exception"].includes(event.category)) return null;
    const recent = await ctx.db.query("deviceEvents").withIndex("by_device_and_event_time", q => q.eq("deviceId", deviceId).gte("eventTime", new Date(Date.now() - 10 * 60_000).toISOString())).order("desc").take(200);
    const sentRecently = recent.some(item => item._id !== event._id && item.alarmNotifiedAt !== undefined && item.label === event.label && item.category === event.category);
    return { event, device: await ctx.db.get(deviceId), recipients: settings.recipients, minSeverity: settings.minSeverity, sentRecently };
  },
});
