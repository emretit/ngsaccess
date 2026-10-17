import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

type SummaryRow = Pick<
  FunctionReturnType<typeof api.cardReadings.getPdksTableData>[number],
  "status" | "overtimeHours" | "days"
>;

export interface PdksSummary {
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  overtimeHours: number;
  attendanceRate: number;
}

/** `todayKey` (yyyy-MM-dd) verilirse dönem modunda henüz gelmemiş günler sayılmaz. */
export function summarizePdksRecords(
  records: readonly SummaryRow[],
  todayKey?: string,
): PdksSummary {
  const summary: PdksSummary = {
    totalEmployees: records.length,
    present: 0,
    late: 0,
    absent: 0,
    leave: 0,
    overtimeHours: 0,
    attendanceRate: 0,
  };
  for (const record of records) {
    if (record.days.length > 0) {
      for (const day of record.days) {
        if (
          (todayKey && day.date > todayKey) ||
          day.status === "future" ||
          day.status === "noData"
        )
          continue;
        summary.overtimeHours += day.overtimeMinutes / 60;
        if (
          day.status === "present" ||
          day.status === "late" ||
          day.status === "absent" ||
          day.status === "leave"
        )
          summary[day.status] += 1;
      }
    } else {
      if (record.status === "future" || record.status === "noData") continue;
      if (
        record.status === "present" ||
        record.status === "late" ||
        record.status === "absent" ||
        record.status === "leave"
      )
        summary[record.status] += 1;
      summary.overtimeHours += record.overtimeHours;
    }
  }
  const personDays =
    summary.present + summary.late + summary.absent + summary.leave;
  summary.attendanceRate =
    personDays === 0
      ? 0
      : Math.round(((summary.present + summary.late) / personDays) * 100);
  summary.overtimeHours = Math.round(summary.overtimeHours * 100) / 100;
  return summary;
}
