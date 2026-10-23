import { StatusBadge } from "@/components/shared/StatusBadge";
import { STATUS_META } from "../statusMeta";
import { planDayLabel, type PdksPlanDay } from "../lib/presentation";

export function PdksPlanSummary({ day }: { day?: PdksPlanDay }) {
  const label = planDayLabel(day);
  if (!label) return null;
  if (day?.planKind === "rest") return <StatusBadge className="whitespace-normal text-left" tone={STATUS_META.weekend.tone}>{label}</StatusBadge>;
  return <span className="block min-w-0 text-xs">
    <span className="block whitespace-normal break-words" title={label}>{label}</span>
    <span className="inline-block rounded-sm border px-1 text-[10px]">{day?.segments?.length} vardiya</span>
  </span>;
}
