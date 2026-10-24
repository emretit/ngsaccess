import { StatusBadge } from "@/components/shared/StatusBadge";
import { STATUS_META } from "../statusMeta";
import { planDayLabel, type PdksPlanDay } from "../lib/presentation";

export function PdksPlanSummary({ day, compact = false }: { day?: PdksPlanDay; compact?: boolean }) {
  const label = planDayLabel(day);
  if (!label) return null;
  if (compact) return <span title={label} className="mx-auto block w-fit whitespace-nowrap rounded-sm border px-1 text-[10px] leading-[10px]">
    {day?.planKind === "rest" ? "Boş gün" : `${day?.segments?.length} vardiya`}
  </span>;
  if (day?.planKind === "rest") return <StatusBadge className="whitespace-normal text-left" tone={STATUS_META.weekend.tone}>{label}</StatusBadge>;
  return <span className="block min-w-0 text-xs">
    <span className="block whitespace-normal break-words" title={label}>{label}</span>
    <span className="inline-block rounded-sm border px-1 text-[10px]">{day?.segments?.length} vardiya</span>
  </span>;
}
