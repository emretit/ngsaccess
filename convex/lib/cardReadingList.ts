import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { trDayRangeISO } from "./trDate";

export function cardReadingDateBounds(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return null;
  const start = startDate ?? endDate;
  const end = endDate ?? startDate;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    throw new Error("Geçerli bir tarih aralığı seçin");
  }
  // Date'in geçersiz takvim günlerini sonraki aya yuvarlamasını kabul etme.
  for (const day of [start, end]) {
    const parsed = new Date(`${day}T12:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
      throw new Error("Geçerli bir tarih aralığı seçin");
    }
  }
  return trDayRangeISO(start, end);
}

export function scopedCardReadingQuery(ctx: Pick<QueryCtx, "db">, args: {
  projectId: Id<"projects">;
  deviceId?: Id<"devices">;
  accessFilter?: "all" | "granted" | "denied";
  startDate?: string;
  endDate?: string;
}) {
  const bounds = cardReadingDateBounds(args.startDate, args.endDate);
  const status = args.accessFilter === "granted" ? "izin_verildi" : args.accessFilter === "denied" ? "reddedildi" : undefined;
  const query = ctx.db.query("cardReadings");
  if (args.deviceId && status) return query.withIndex("by_project_device_status_time", q => {
    const prefix = q.eq("projectId", args.projectId).eq("deviceId", args.deviceId).eq("accessStatus", status);
    return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
  });
  if (args.deviceId) return query.withIndex("by_project_device_time", q => {
    const prefix = q.eq("projectId", args.projectId).eq("deviceId", args.deviceId);
    return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
  });
  if (status) return query.withIndex("by_project_status_time", q => {
    const prefix = q.eq("projectId", args.projectId).eq("accessStatus", status);
    return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
  });
  return query.withIndex("by_project_access_time", q => {
    const prefix = q.eq("projectId", args.projectId);
    return bounds ? prefix.gte("accessTime", bounds.startISO).lte("accessTime", bounds.endISO) : prefix;
  });
}
