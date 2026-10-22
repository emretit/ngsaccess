import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export type AlarmSeverity = "info" | "warning" | "critical";
export type AlarmCategory = "alarm" | "exception";

/** Debounce penceresi; taze olay sınırı da aynı (pencere "şimdi"ye göre hesaplanır). */
export const ALARM_WINDOW_MS = 10 * 60_000;

/** Cihaz saatinin sunucudan ileride olmasına tanınan pay. */
const ALARM_CLOCK_SKEW_MS = 2 * 60_000;

/**
 * Tarihsel backfill'den gelen eski olaylar e-posta tetiklemesin: debounce yalnız taze olayda anlamlı.
 * Saati ileri kaymış cihazın gelecek tarihli olayı da taze sayılmaz (debounce'u uzun süre kilitlemesin).
 */
export function isFreshAlarmEvent(eventTime: string, now = Date.now()): boolean {
  const time = Date.parse(eventTime);
  return Number.isFinite(time) && time >= now - ALARM_WINDOW_MS && time <= now + ALARM_CLOCK_SKEW_MS;
}

export function shouldNotifyAlarm(input: { severity: AlarmSeverity; minSeverity: "warning" | "critical"; emailEnabled: boolean; sentRecently: boolean }): boolean {
  const severityRank: Record<AlarmSeverity, number> = { info: 0, warning: 1, critical: 2 };
  return input.emailEnabled && !input.sentRecently && severityRank[input.severity] >= severityRank[input.minSeverity];
}

export async function notifyAlarmIfNeeded(ctx: MutationCtx, eventId: Id<"deviceEvents">): Promise<void> {
  const event = await ctx.db.get(eventId);
  if (!event?.deviceId || !event.projectId || (event.category !== "alarm" && event.category !== "exception") || event.severity === "info") return;
  if (event.alarmQueuedAt || !isFreshAlarmEvent(event.eventTime)) return;
  const projectId = event.projectId;
  const settings = await ctx.db.query("alarmSettings").withIndex("by_project", q => q.eq("projectId", projectId)).unique();
  if (!settings?.emailEnabled || settings.recipients.length === 0 || (settings.minSeverity === "critical" && event.severity !== "critical")) return;

  const cutoff = new Date(Date.now() - ALARM_WINDOW_MS).toISOString();
  const recent = await ctx.db.query("deviceEvents")
    .withIndex("by_device_and_event_time", q => q.eq("deviceId", event.deviceId).gte("eventTime", cutoff))
    .order("desc")
    .take(200);
  // Cihaz kimliği debounce anahtarının parçasıdır; başka cihazın arızası bastırılmaz.
  // Bastırma bildirimin kendi zamanına bakar; olay saati (cihaz saati) tek başına bildirim yaşını göstermez.
  const sentRecently = recent.some(item => item._id !== event._id && item.deviceId === event.deviceId && (item.alarmQueuedAt ?? item.alarmNotifiedAt ?? "") >= cutoff && item.label === event.label && item.category === event.category);
  if (!shouldNotifyAlarm({ severity: event.severity, minSeverity: settings.minSeverity, emailEnabled: true, sentRecently })) return;

  const notifiedAt = new Date().toISOString();
  try {
    await ctx.scheduler.runAfter(0, internal.actions.sendAlarmEmail.send, { eventId });
    await ctx.db.patch(eventId, { alarmQueuedAt: notifiedAt, alarmEmailStatus: "queued", alarmEmailAttempts: 0, alarmEmailRecipients: settings.recipients, updatedAt: notifiedAt });
    await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
  } catch {
    await ctx.db.patch(eventId, { alarmEmailStatus: "failed", alarmEmailError: "Alarm e-postası zamanlanamadı", alarmEmailAttemptAt: notifiedAt, updatedAt: notifiedAt });
    await ctx.db.patch(settings._id, { lastEmailEventId: eventId });
  }
}
