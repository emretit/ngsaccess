import { visibleRoutes } from "@/lib/routeMeta";

/** Fold dotted/dotless I as well as accents for Turkish and ASCII keyboards. */
export function normalizeNavigationSearch(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "").trim();
}
export function filterNavigationRoutes(role: string | undefined, query: string) {
  const terms = normalizeNavigationSearch(query).split(/\s+/);
  return visibleRoutes(role, true).filter(route => terms.every(term => normalizeNavigationSearch(route.name).includes(term)));
}
