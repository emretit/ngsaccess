import { flexibleTargetLabel } from "../lib/presentation";

/** Esnek vardiyada net hedefe göre eksik/fazla süre; eksik süre uyarı renginde. */
export function PdksFlexibleTarget({ day, className = "block" }: { day: Parameters<typeof flexibleTargetLabel>[0]; className?: string }) {
  const label = flexibleTargetLabel(day);
  if (!label) return null;
  return <span className={`${className} ${label.shortfall ? "text-warning" : "text-muted-foreground"}`}>{label.text}</span>;
}
