import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../../convex/_generated/api";
export type Summary = FunctionReturnType<
  typeof api.accessRules.listSummaries
>["page"][number];
export function scopeText(rule: Summary) {
  if (rule.scopeTruncated) return "Geniş kapsam · Ayrıntıyı aç";
  const panels = rule.panels.map((panel) => panel.label).join(", ");
  return (
    [
      panels,
      rule.unassignedDoors.length
        ? "Cihaz bağlantısı yok; cihaza uygulanamaz"
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Kapı veya cihaz seçilmemiş"
  );
}

export function readRuleFilters(params: URLSearchParams) {
  const search = params.get("q") ?? "";
  const searchBy =
    params.get("by") === "person"
      ? "person"
      : params.get("by") === "door"
        ? "door"
        : "rule";
  const status =
    params.get("durum") === "active"
      ? "active"
      : params.get("durum") === "inactive"
        ? "inactive"
        : "all";
  const type =
    params.get("tur") === "visitor"
      ? "visitor"
      : params.get("tur") === "personnel"
        ? "personnel"
        : "all";
  return { search, searchBy, status, type } as const;
}
