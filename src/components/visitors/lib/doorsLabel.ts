/** Otomatik ziyaretçi kuralı adındaki "Ziyaretçi · " önekini kapı listesinde gizler. */
export function visitorDoorsLabel(ruleName: string | null | undefined): string | null {
  return ruleName ? ruleName.replace(/^Ziyaretçi · /, "") : null;
}
