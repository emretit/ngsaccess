import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
export type Reading = FunctionReturnType<typeof api.cardReadings.listLiveSince>["rows"][number];
export type Filters = { mode: "live" | "history"; search: string; device: string; employee: string; door: string; result: "all" | "granted" | "denied" | "unknown"; start: string; end: string };
export const emptyFilters: Filters = { mode: "live", search: "", device: "", employee: "", door: "", result: "all", start: "", end: "" };
export const sourceLabel = (source: Reading["source"]) => ({ card: "Kart", qr: "QR", mobile: "Mobil", biometric: "Biyometrik · PDKS dışı", unknown: "Kaynak bilinmiyor" })[source];
export const resultLabel = (r: Pick<Reading, "accessStatus">) => r.accessStatus === "izin_verildi" ? "İzin verildi" : r.accessStatus === "reddedildi" ? "Reddedildi" : "Sonuç bilinmiyor";
export const personLabel = (r: Reading) => r.employeeName?.trim() || (r.employeeId ? "Kişi bilgisi yok" : "Kişi eşleşmedi");
export const trTime = (time: string) => Number.isFinite(Date.parse(time)) ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(time)) : "Zaman bilinmiyor";
export function mergeRows<T extends { _id: string; _creationTime: number }>(before: readonly T[], incoming: readonly T[], limit = 500) {
  return [...new Map([...before, ...incoming].map(r => [r._id, r])).values()].sort((a, b) => b._creationTime - a._creationTime || b._id.localeCompare(a._id)).slice(0, limit);
}
export function matches(r: Reading, f: Filters) {
  const term = f.search.trim().toLocaleLowerCase("tr-TR");
  const result = r.accessStatus === "izin_verildi" ? "granted" : r.accessStatus === "reddedildi" ? "denied" : "unknown";
  return (!f.device || r.deviceId === f.device) && (!f.employee || r.employeeId === f.employee) && (!f.door || r.door?._id === f.door) && (f.result === "all" || f.result === result) && (!term || `${personLabel(r)} ${r.cardNo}`.toLocaleLowerCase("tr-TR").includes(term));
}
export function readFilters(params: URLSearchParams, project: string): Filters {
  if (params.get("liveProject") && params.get("liveProject") !== project) return { ...emptyFilters };
  const result = params.get("result");
  const start = params.get("start") ?? "", end = params.get("end") ?? "";
  return { mode: params.get("mode") === "history" || start || end ? "history" : "live", search: params.get("q") ?? "", device: params.get("device") ?? "", employee: params.get("employee") ?? "", door: params.get("door") ?? "", result: result === "granted" || result === "denied" || result === "unknown" ? result : "all", start: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : "", end: /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : "" };
}
export function writeFilters(params: URLSearchParams, filters: Filters, project: string) {
  const next = new URLSearchParams(params);
  next.set("liveProject", project);
  for (const [key, value] of Object.entries({ mode: filters.mode, q: filters.search, device: filters.device, employee: filters.employee, door: filters.door, result: filters.result, start: filters.start, end: filters.end })) {
    if (value && value !== "all") next.set(key, value); else next.delete(key);
  }
  return next;
}
export function physicalCard(card: string) { return /^[A-Za-z0-9_-]{1,32}$/.test(card) && !/^0+$/.test(card) && !/^(unknown|null|undefined|none)$/i.test(card); }
