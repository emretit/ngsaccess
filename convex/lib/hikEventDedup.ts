import { toUtcISO } from "./trDate";

/** Candidates must already have the same device and serial number. Serials reset. */
export function sameHikEvent(
  existing: { cardNo?: string; accessTime?: string; eventTime?: string; hikDateTime?: string },
  incoming: { cardNo?: string; time: string; deviceTime?: string; alternateTime?: string },
): boolean {
  if ((existing.cardNo?.trim() ?? "") !== (incoming.cardNo?.trim() ?? "")) return false;
  const deviceTime = incoming.deviceTime ? toUtcISO(incoming.deviceTime) : undefined;
  if (deviceTime && existing.hikDateTime && toUtcISO(existing.hikDateTime) === deviceTime) return true;
  const existingMs = Date.parse(existing.accessTime ?? existing.eventTime ?? "");
  // HTTP forwarding honors the offset; ISUP can rewrite it to +03:00 while
  // history still carries the original label. Both interpretations identify a retry.
  return [incoming.time, incoming.alternateTime].some(time =>
    time !== undefined && Math.abs(existingMs - Date.parse(time)) <= 10 * 60 * 1000);
}
