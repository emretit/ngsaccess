import { usePermissions } from "@/hooks/usePermissions";
import { useShiftPlanOpen } from "@/components/shifts/ShiftPlanSheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { statusMetaFor } from "../statusMeta";
import { reviewHint, type PdksRow } from "../lib/presentation";
import { PdksExcludedReadingsNotice } from "./PdksExcludedReadingsNotice";
export function PdksRowStatus({ record }: { record: PdksRow }) {
  if (record.noShift) return <NoShiftStatus />;
  const meta = statusMetaFor(record);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      {reviewHint(record) && <span className="text-xs text-muted-foreground" title={reviewHint(record)}>{reviewHint(record)}</span>}
      {(record.incompleteDays ?? 0) > 0 && <span className="text-xs text-muted-foreground">İnceleme: {record.incompleteDays}</span>}
      {record.isEarlyExit && (
        <StatusBadge tone="warning">Erken çıkış</StatusBadge>
      )}
      {record.isManual && <StatusBadge tone="neutral">Manuel</StatusBadge>}
      <PdksExcludedReadingsNotice count={record.excludedUnknownReadings} />
      {record.leaveType && (
        <span className="text-xs text-muted-foreground">
          {record.leaveType}
        </span>
      )}
    </div>
  );
}

export function NoShiftStatus() {
  const { can } = usePermissions();
  const { setOpen } = useShiftPlanOpen();
  return <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
    <StatusBadge tone="neutral">Vardiya atanmamış</StatusBadge>
    {can("schedule.manage") && <button type="button" className="underline" onClick={event => { event.stopPropagation(); setOpen(true); }}>Vardiya ata</button>}
  </div>;
}
