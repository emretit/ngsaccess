import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { STATUS_META, statusMetaFor } from "../statusMeta";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
export type PdksRow = FunctionReturnType<
  typeof api.cardReadings.getPdksTableData
>[number];
export type PdksCell = PdksRow["days"][number];
export type SortKey =
  | "name"
  | "department"
  | "firstEntry"
  | "lastExit"
  | "totalMinutes"
  | "overtimeMinutes"
  | "status";
export function formatDuration(minutes: number, compact = false): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = String(Math.floor(safe / 60)).padStart(2, "0");
  const m = String(safe % 60).padStart(2, "0");
  return compact ? `${h}:${m}` : `${h} sa ${m} dk`;
}
export function displayDuration(minutes: number, status: PdksCell["status"], durationMeasured?: boolean): string {
  if (durationMeasured === false) return "Süre hesaplanamadı";
  return minutes === 0 && status !== "present" && status !== "late" || status === "future" || status === "noData" || status === "notEmployed" ? "—" : formatDuration(minutes);
}
export function timeMinutes(value: string | null): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function punchQualityHint(quality: string | undefined): string {
  switch (quality) {
    case "missingExit": return "Çıkış okutması yok";
    case "missingEntry": return "Giriş okutması yok";
    case "noPunch": return "Okutma yok";
    case "undirected": return "Yön bilgisi yok";
    default: return "";
  }
}
/** Legacy rows also carry punchQuality; the hint is shown only where the rule decision needs it. */
export function reviewHint(item: { status: string; punchQuality?: string; durationMeasured?: boolean } | undefined): string {
  if (!item || (item.status !== "incomplete" && item.durationMeasured !== false)) return "";
  return punchQualityHint(item.punchQuality);
}
export function displayTime(value: string | null): string {
  return timeMinutes(value) === null ? "—" : (value ?? "—");
}
export function compareRows(
  a: PdksRow,
  b: PdksRow,
  key: SortKey,
  direction: "asc" | "desc",
): number {
  let result: number;
  if (key === "firstEntry" || key === "lastExit") {
    const x = timeMinutes(a[key]),
      y = timeMinutes(b[key]);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    result = x - y;
  } else if (key === "totalMinutes" || key === "overtimeMinutes")
    result = a[key] - b[key];
  else
    result = (
      key === "status" ? statusMetaFor(a).label : a[key]
    ).localeCompare(
      key === "status" ? statusMetaFor(b).label : b[key],
      "tr",
    );
  return direction === "asc" ? result : -result;
}
export function readableDate(date: string): string {
  return format(new Date(`${date}T12:00:00`), "d MMMM yyyy EEEE", {
    locale: tr,
  });
}
export function cellLabel(name: string, date: string, cell?: PdksCell): string {
  const status = cell?.status ?? "noData";
  const duration =
    cell?.durationMeasured === false ? "Süre hesaplanamadı" : status === "future" || status === "noData" || status === "notEmployed"
      ? "Süre yok"
      : `${Math.floor((cell?.totalMinutes ?? 0) / 60)} saat ${(cell?.totalMinutes ?? 0) % 60} dakika`;
  return `${name}, ${readableDate(date)}, ${statusMetaFor(cell ?? { status }).label}, ${duration}${reviewHint(cell) ? `, ${reviewHint(cell)}` : ""}`;
}
export function periodTotals(days: readonly PdksCell[]) {
  return days.reduce(
    (sum, day) =>
      day.status === "future" || day.status === "noData" || day.status === "notEmployed"
        ? sum
        : {
            totalMinutes: sum.totalMinutes + day.totalMinutes,
            overtimeMinutes: sum.overtimeMinutes + day.overtimeMinutes,
          },
    { totalMinutes: 0, overtimeMinutes: 0 },
  );
}
export function validateManual(
  entry: string,
  exit: string,
  note: string,
  isOvernightShift = false,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (entry && timeMinutes(entry) === null)
    errors.entry = "Geçerli bir saat girin (08:30).";
  if (exit && timeMinutes(exit) === null)
    errors.exit = "Geçerli bir saat girin (08:30).";
  if (!entry && !exit) errors.entry = "En az bir saat girin.";
  if (entry && exit && !errors.entry && !errors.exit && entry >= exit && !isOvernightShift)
    errors.exit = "Çıkış saati girişten sonra olmalı.";
  if (note.trim().length < 3 || note.trim().length > 500)
    errors.note = "Gerekçe 3–500 karakter olmalı.";
  return errors;
}

/** In a period, retain employees with at least one matching day; keep all their cells. */
export function filterPdksRows(
  rows: PdksRow[],
  status: "all" | keyof typeof STATUS_META | undefined,
): PdksRow[] {
  if (!status || status === "all") return rows;
  return rows.filter((row) => {
    if (status === "overtime")
      return row.days.length > 1
        ? row.days.some(
            (day) =>
              day.overtimeMinutes > 0 &&
              day.status !== "future" &&
              day.status !== "noData",
          )
        : row.overtimeMinutes > 0;
    return row.days.length > 1
      ? row.days.some((day) => day.status === status)
      : row.status === status;
  });
}

const LEAVE_LABELS: Record<string, string> = {
  annual: "Yıllık izin",
  sick: "Hastalık izni",
  excuse: "Mazeret izni",
  unpaid: "Ücretsiz izin",
  parental: "Doğum / ebeveyn izni",
  marriage: "Evlilik izni",
  bereavement: "Vefat izni",
  paternity: "Babalık izni",
  lactation: "Süt izni",
  compensatory: "Telafi izni",
};
export function leaveLabel(value: string): string {
  return LEAVE_LABELS[value] ?? value;
}
