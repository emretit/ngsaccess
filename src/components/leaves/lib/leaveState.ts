import { errorMessage } from "@/lib/notify";
import { z } from "zod";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";

export type LeaveRow = FunctionReturnType<
  typeof api.leaves.listPage
>["page"][number];
export const leaveTypes = {
  annual: "Yıllık izin",
  sick: "Hastalık izni",
  excuse: "Mazeret izni",
  unpaid: "Ücretsiz izin",
  parental: "Doğum izni",
  marriage: "Evlilik izni",
  bereavement: "Vefat izni",
  paternity: "Babalık izni",
  lactation: "Süt izni",
  compensatory: "Telafi izni",
} as const;
export const leaveStatuses = {
  approved: { label: "Onaylı", tone: "success" },
  pending: { label: "Beklemede", tone: "warning" },
  rejected: { label: "Reddedildi", tone: "danger" },
} as const;
export const leaveTypeSchema = z.enum([
  "annual",
  "sick",
  "excuse",
  "unpaid",
  "parental",
  "marriage",
  "bereavement",
  "paternity",
  "lactation",
  "compensatory",
]);
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function calendarDays(start: string, end: string): number | null {
  if (!validDate(start) || !validDate(end) || start > end) return null;
  return (
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86400000 +
    1
  );
}
export function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(`${month}-01`))
    return undefined;
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return {
    rangeStart: `${month}-01`,
    rangeEnd: date.toISOString().slice(0, 10),
  };
}
export function currentMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}
export function readFilters(params: URLSearchParams, now?: Date) {
  const month = currentMonth(now);
  const fallback = monthRange(month) ?? {
    rangeStart: `${month}-01`,
    rangeEnd: `${month}-28`,
  };
  const from = params.get("from") ?? "",
    to = params.get("to") ?? "";
  const custom =
    params.get("period") === "custom" &&
    validDate(from) &&
    validDate(to) &&
    from <= to;
  const period = custom
    ? "custom"
    : monthRange(params.get("period") ?? "")
      ? (params.get("period") ?? month)
      : month;
  return {
    ...(custom
      ? { rangeStart: from, rangeEnd: to }
      : (monthRange(period) ?? fallback)),
    period,
    employeeId: params.get("employee") || undefined,
    leaveType: leaveTypeSchema.safeParse(params.get("type")).data,
    pageSize: params.get("size") === "50" ? 50 : 25,
  };
}
export function projectScopedLeaveParams(
  params: URLSearchParams,
  projectId: string,
): URLSearchParams {
  if (!params.has("scope")) return params;
  const next = new URLSearchParams(params);
  if (params.get("scope") !== projectId) {
    for (const key of ["employee", "leave", "cursor"]) next.delete(key);
  }
  next.delete("scope");
  return next;
}
export function dateLabel(value: string): string {
  return validDate(value) ? value.split("-").reverse().join(".") : value;
}
export function pdksHref(row: LeaveRow): string {
  const params = new URLSearchParams({
    report: "custom",
    from: row.startDate,
    to: row.endDate,
    date: row.startDate,
  });
  if (!row.employeeMissing) params.set("employeeId", row.employeeId);
  return `/pdks-records?${params}`;
}
export function makeLeaveFormSchema(
  original?: Pick<LeaveRow, "startDate" | "endDate">,
) {
  return z
    .object({
      employeeId: z.string().min(1, "Bir kişi seçin."),
      leaveType: leaveTypeSchema,
      startDate: z.string(),
      endDate: z.string(),
      notes: z.string(),
    })
    .superRefine((value, ctx) => {
      // Unchanged legacy dates may be invalid or longer than today's creation limit.
      if (
        original &&
        value.startDate === original.startDate &&
        value.endDate === original.endDate
      )
        return;
      for (const field of ["startDate", "endDate"] as const) {
        const date = value[field];
        if (!date)
          ctx.addIssue({
            code: "custom",
            path: [field],
            message:
              field === "startDate"
                ? "Başlangıç tarihini girin."
                : "Bitiş tarihini girin.",
          });
        else if (!validDate(date))
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Geçerli bir tarih girin.",
          });
      }
      if (!validDate(value.startDate) || !validDate(value.endDate)) return;
      if (value.startDate > value.endDate)
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "Bitiş tarihi başlangıçtan önce olamaz.",
        });
      const days = calendarDays(value.startDate, value.endDate);
      if (days !== null && days > 366)
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "Tek bir izin kaydı en fazla 366 takvim günü olabilir.",
        });
    });
}
export const leaveFormSchema = makeLeaveFormSchema();
export type LeaveFormValues = z.infer<typeof leaveFormSchema>;
export function leaveError(error: unknown): {
  code?: string;
  message: string;
  conflict?: { id: string; start: string; end: string };
} {
  const data =
    error && typeof error === "object" && "data" in error
      ? error.data
      : undefined;
  if (!data || typeof data !== "object")
    return {
      message: "İzin kaydedilemedi. Bilgileriniz korunuyor; tekrar deneyin.",
    };
  const code =
    "code" in data && typeof data.code === "string" ? data.code : undefined;
  const message =
    code === "LEAVE_STALE"
      ? "Kayıt başka bir yerde değişti; yenileyip tekrar deneyin."
      : "message" in data && typeof data.message === "string"
        ? errorMessage(data.message)
        : "İzin kaydedilemedi. Bilgileriniz korunuyor; tekrar deneyin.";
  const conflict =
    "conflictLeaveId" in data &&
    typeof data.conflictLeaveId === "string" &&
    "conflictStartDate" in data &&
    typeof data.conflictStartDate === "string" &&
    "conflictEndDate" in data &&
    typeof data.conflictEndDate === "string"
      ? {
          id: data.conflictLeaveId,
          start: data.conflictStartDate,
          end: data.conflictEndDate,
        }
      : undefined;
  return { code, message, conflict };
}

/**
 * Sayfa sınırı: önceki sayfanın son kayıtlarının kimlikleri (en yakından uzağa).
 * Sıra numarası yerine kimlikle tutulur; canlı listede kayıt eklenince/silinince
 * sayfalar kaymaz. `fallback` yalnız hiçbir kimlik bulunamazsa kullanılır.
 */
export type LeavePageBoundary = { after: string[]; fallback: number };

const BOUNDARY_ANCHORS = 3;

export function boundaryFor(rows: readonly { _id: string }[]): LeavePageBoundary {
  return {
    after: rows.slice(-BOUNDARY_ANCHORS).reverse().map((row) => row._id),
    fallback: rows.length,
  };
}

/** Sınırdan sonraki ilk kaydın sırası; bulunan en yakın kimliğe göre. */
export function boundaryIndex(
  rows: readonly { _id: string }[],
  boundary: LeavePageBoundary,
): number {
  for (const id of boundary.after) {
    const found = rows.findIndex((row) => row._id === id);
    if (found >= 0) return found + 1;
  }
  return Math.min(boundary.fallback, rows.length);
}

/**
 * `index`. sayfanın kayıtları. `boundaries[i]` i. sayfanın sonudur; son sayfa için
 * henüz kaydedilmemiş sınır `pending` ile verilir (sonraki sayfa yüklenirken).
 */
export function pageSlice<T extends { _id: string }>(
  rows: readonly T[],
  boundaries: readonly LeavePageBoundary[],
  index: number,
  pending?: LeavePageBoundary | null,
): T[] {
  const start = index === 0 ? 0 : boundaryIndex(rows, boundaries[index - 1]);
  const end = boundaries[index] ?? pending;
  return rows.slice(start, end ? boundaryIndex(rows, end) : undefined);
}
