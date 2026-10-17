import { StatusBadge } from "@/components/shared/StatusBadge";
import { STATUS_META } from "../statusMeta";
import type { PdksRow } from "../lib/presentation";
export function PdksRowStatus({ record }: { record: PdksRow }) {
  const meta = STATUS_META[record.status];
  return (
    <div className="flex flex-wrap items-center gap-1">
      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      {record.isEarlyExit && (
        <StatusBadge tone="warning">Erken çıkış</StatusBadge>
      )}
      {record.isManual && <StatusBadge tone="neutral">Manuel</StatusBadge>}
      {record.leaveType && (
        <span className="text-xs text-muted-foreground">
          {record.leaveType}
        </span>
      )}
    </div>
  );
}
