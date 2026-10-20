import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export type AlarmSeverity = "info" | "warning" | "critical";
export type AlarmCategory = "alarm" | "exception";

/** Debounce penceresi; taze olay sınırı da aynı (pencere "şimdi"ye göre hesaplanır). */
export const ALARM_WINDOW_MS = 10 * 60_000;

/** Tarihsel backfill'den gelen eski olaylar e-posta tetiklemesin: debounce yalnız taze olayda anlamlı. */
export function isFreshAlarmEvent(eventTime: string, now = Date.now()): boolean {
  const time = Date.parse(eventTime);
  return Number.isFinite(time) && time >= now - ALARM_WINDOW_MS;
}

export function shouldNotifyAlarm(input: { severity: AlarmSeverity; minSeverity: "warning" | "critical"; emailEnabled: boolean; sentRecently: boolean }): boolean {
  const severityRank: Record<AlarmSeverity, number> = { info: 0, warning: 1, critical: 2 };
  return input.emailEnabled && !input.sentRecently && severityRank[input.severity] >= severityRank[input.minSeverity];
}

export async function notifyAlarmIfNeeded(ctx: MutationCtx, eventId: Id<"deviceEvents">): Promise<void> {
  const event = await ctx.db.get(eventId);
  if (!event?.deviceId || !event.projectId || (event.category !== "alarm" && event.category !== "exception") || event.severity === "info") return;
  const projectId = event.projectId;
  const settings = await ctx.db.query("alarmSettings").withIndex("by_project", q => q.eq("projectId", projectId)).unique();
  if (!settings?.emailEnabled || settings.recipients.length === 0 || (settings.minSeverity === "critical" && event.severity !== "critical")) return;

  const cutoff = new Date(Date.now() - ALARM_WINDOW_MS).toISOString();
  const recent = await ctx.db.query("deviceEvents")
    .withIndex("by_device_and_event_time", q => q.eq("deviceId", event.deviceId).gte("eventTime", cutoff))
    .order("desc")
    .take(200);
  const sentRecently = recent.some(item => item._id !== event._id && item.alarmNotifiedAt !== undefined && item.label === event.label && item.category === event.category);
  if (!shouldNotifyAlarm({ severity: event.severity, minSeverity: settings.minSeverity, emailEnabled: true, sentRecently })) return;

  const notifiedAt = new Date().toISOString();
  await ctx.db.patch(eventId, { alarmNotifiedAt: notifiedAt, updatedAt: notifiedAt });
  try {
    await ctx.scheduler.runAfter(0, internal.actions.sendAlarmEmail.send, { eventId });
  } catch {
    console.error("Alarm e-postası zamanlanamadı");
  }
}
