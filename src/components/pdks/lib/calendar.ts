import { endOfMonth, endOfWeek, min, startOfMonth, startOfWeek } from "date-fns";
import { todayInTurkey } from "@/lib/date";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";

export function pdksToday(): Date {
  return new Date(`${todayInTurkey()}T12:00:00`);
}

/** Ekrandaki dönemin gün aralığı; bugünden ileri taşmaz. */
export function currentPeriodRange(values: FilterValues): { from: Date; to: Date } {
  const today = pdksToday();
  const anchor = values.anchorDate ?? today;
  if (values.reportType === "custom") {
    return { from: values.dateRange.from ?? anchor, to: values.dateRange.to ?? anchor };
  }
  if (values.reportType === "monthly") {
    return { from: startOfMonth(anchor), to: min([endOfMonth(anchor), today]) };
  }
  if (values.reportType === "weekly") {
    return { from: startOfWeek(anchor, { weekStartsOn: 1 }), to: min([endOfWeek(anchor, { weekStartsOn: 1 }), today]) };
  }
  return { from: anchor, to: anchor };
}
