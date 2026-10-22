import { StatusBadge } from "@/components/shared/StatusBadge";
import { statusMetaFor } from "../statusMeta";
import { reviewHint, type PdksRow } from "../lib/presentation";
import { PdksExcludedReadingsNotice } from "./PdksExcludedReadingsNotice";
export function PdksRowStatus({ record }: { record: PdksRow }) {
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
