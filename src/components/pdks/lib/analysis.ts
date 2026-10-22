import { isPdksInProgress } from "../statusMeta";
import type { PdksRow } from "./presentation";
import type { PdksDayStatus } from "../../../../convex/lib/pdksTable";
export interface AnalysisDay {
  date: string;
  counts: Record<PdksDayStatus, number>;
  inProgress: number;
  totalMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
}
/** Use exactly the rendered rows: no second query or implicit date expansion. */
export function analyzePdksRows(rows: readonly PdksRow[]): AnalysisDay[] {
  const days = new Map<string, AnalysisDay>();
  for (const row of rows)
    for (const cell of row.days) {
      if (cell.status === "notEmployed") continue;
      const item = days.get(cell.date) ?? {
        date: cell.date,
        counts: {
          present: 0,
          late: 0,
          absent: 0,
          leave: 0,
          weekend: 0,
          holiday: 0,
          future: 0,
          noData: 0,
          notEmployed: 0, incomplete: 0,
        },
        inProgress: 0,
        totalMinutes: 0,
        lateMinutes: 0,
        overtimeMinutes: 0,
      };
      item.counts[cell.status]++;
      if (isPdksInProgress(cell)) item.inProgress++;
      if (cell.status !== "future" && cell.status !== "noData") {
        item.totalMinutes += cell.totalMinutes;
        item.overtimeMinutes += cell.overtimeMinutes;
        item.lateMinutes += cell.lateMinutes;
      }
      days.set(cell.date, item);
    }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
