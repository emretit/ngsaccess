/** Cloud equivalent of hikSync.defaultRuleSchedule; both boundaries include the minute. */
export interface RuleSchedule {
  projectId?: string;
  days?: readonly string[];
  startTime?: string;
  endTime?: string;
}

const istanbulClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Istanbul", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function isRuleOpenAt(rule: RuleSchedule, nowMs: number): boolean {
  if (!Number.isFinite(nowMs)) return false;
  const parts = istanbulClock.formatToParts(new Date(nowMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  // Same empty-day defaults as the device; malformed nonempty days never open.
  const days = rule.days?.filter(Boolean) ?? [];
  if (days.length && !days.includes(part("weekday"))) return false;
  const start = rule.startTime?.trim() || "00:00";
  const end = rule.endTime?.trim() || "23:59";
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!validTime.test(start) || !validTime.test(end) || start > end) return false;
  const time = `${part("hour")}:${part("minute")}`;
  // Hik receives endTime HH:MM:59: the entire final minute is permitted.
  return time >= start && time <= end;
}
