import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { skipReasons } from "../../../../../convex/lib/syncReasons";

export type GrantRow = FunctionReturnType<
  typeof api.accessGrantStatus.listByProject
>["page"][number];
export type EmployeeDetail = FunctionReturnType<
  typeof api.accessGrantStatus.byEmployee
>;
export type Counts = FunctionReturnType<typeof api.accessGrantStatus.counts>;
export type Pair = { employeeId: Id<"employees">; deviceId: Id<"devices"> };
export type Filters = {
  departmentId?: Id<"departments">;
  deviceId?: Id<"devices">;
  ruleId?: Id<"accessRules">;
  state?: GrantRow["state"];
  search?: string;
};
export const labels = {
  all: "Tümü",
  effective: "Etkin",
  pending: "Bekliyor",
  failed: "Hata",
  removed: "Kaldırıldı",
  unknown: "Bilinmiyor",
};
export const countText = (value: number, capped: boolean) =>
  capped && value >= 1000 ? "1000+" : String(value);
export function queryArgs(
  projectId: Id<"projects">,
  filters: Filters,
  cursor: string | null = null,
): FunctionArgs<typeof api.accessGrantStatus.listByProject> {
  return {
    projectId,
    ...filters,
    search: filters.search?.trim() || undefined,
    paginationOpts: { numItems: 50, cursor },
  };
}
export const pairKey = (pair: Pair) => `${pair.employeeId}:${pair.deviceId}`;
export function togglePair(
  selected: Pair[],
  pair: Pair,
): { pairs: Pair[]; error?: string } {
  if (selected.some((p) => pairKey(p) === pairKey(pair)))
    return { pairs: selected.filter((p) => pairKey(p) !== pairKey(pair)) };
  if (selected.length >= 100)
    return { pairs: selected, error: "En çok 100 kişi–cihaz kaydı seçebilirsiniz." };
  return { pairs: [...selected, pair] };
}
export const confirmationText = (count: number | string) =>
  `${count} kişi–cihaz kaydı için tek gönderim başlatılacak.`;
/** Keep device diagnostics in the drawer; list reasons stay short and readable. */
export function shortFailureReason(error?: string): string {
  if (error?.includes("door_io_unresolved")) return "Kapı eşleştirilemedi";
  if (/çevrimdışı|offline/i.test(error ?? "")) return skipReasons.offline;
  if (/pasif/i.test(error ?? "")) return skipReasons.inactive;
  if (/yanıt|timeout|timed out/i.test(error ?? "")) return "Cihaz yanıt vermedi";
  return "Gönderim başarısız oldu";
}
export function grantBadge(
  row: Pick<EmployeeDetail["rows"][number], "state"> & Partial<Pick<GrantRow, "stale" | "lastError" | "doorUnresolved">>,
) {
  return {
    label: labels[row.state],
    stale: row.stale === true,
    tone:
      row.state === "failed"
        ? ("danger" as const)
        : row.state === "pending"
          ? ("warning" as const)
          : row.state === "effective"
            ? ("success" as const)
            : ("neutral" as const),
    hint: row.state === "failed" ? shortFailureReason(row.lastError) : undefined,
  };
}

/** Preserve identity so the initial empty debounce does not trigger a second query. */
export function searchFilters(filters: Filters, search: string): Filters {
  const trimmed = search.trim();
  return (filters.search ?? "") === trimmed ? filters : { ...filters, search: trimmed };
}
export function failedConfirmationText(failed: number, capped: boolean): string {
  const total = countText(failed, capped);
  if (failed <= 100) return confirmationText(total);
  const remaining = `${failed - 100}${capped && failed >= 1000 ? "+" : ""}`;
  return `İlk 100 kayıt gönderilecek; kalan ${remaining} sonraki turda.`;
}
export function redistributionSuccessText(result: Pick<FunctionReturnType<typeof api.accessGrantStatus.redistribute>, "pairCount" | "remainingFailed" | "remainingCapped">): string {
  const remaining = result.remainingFailed > 0
    ? ` Kalan ${result.remainingFailed}${result.remainingCapped ? "+" : ""} hatalı kayıt sonraki turda.`
    : "";
  return `${result.pairCount ?? "Tüm yetkili"} kayıt gönderime alındı.${remaining}`;
}
