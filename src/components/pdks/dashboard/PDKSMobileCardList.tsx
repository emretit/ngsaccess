import { Checkbox } from "@/components/ui/checkbox";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Id } from "../../../../convex/_generated/dataModel";
import { displayTime, displayDuration, type PdksRow } from "../lib/presentation";
import { PdksRowStatus } from "./PdksRowStatus";
export function PDKSMobileCardList({
  records,
  selectedIds,
  onToggleSelect,
  onShowDetail,
}: {
  records: PdksRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onShowDetail?: (id: Id<"employees">) => void;
}) {
  return (
    <ul className="divide-y border-y">
      {records.map((r) => (
        <li
          className={`min-w-0 py-3 ${selectedIds.has(r.id) ? "bg-selected" : ""}`}
          key={r.id}
        >
          <div className="flex min-w-0 items-start gap-2">
            <Checkbox
              className="mt-2"
              aria-label={`${r.name} seç`}
              checked={selectedIds.has(r.id)}
              onCheckedChange={() => onToggleSelect(r.id)}
            />
            <div className="min-w-0 flex-1">
              <button
                className="min-h-9 text-left font-medium break-words"
                onClick={() => onShowDetail?.(r.id as Id<"employees">)}
              >
                {r.name}
              </button>
              <p className="text-xs text-muted-foreground">
                {r.department || "—"}
              </p>
              <div className="mt-2">
                <PdksRowStatus record={r} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs tabular-nums">
                <div>
                  <dt className="text-muted-foreground">Giriş</dt>
                  <dd>{displayTime(r.firstEntry)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Çıkış</dt>
                  <dd>{displayTime(r.lastExit)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Toplam</dt>
                  <dd>{displayDuration(r.totalMinutes, r.status)}</dd>
                </div>
              </dl>
              {r.overtimeMinutes > 0 && (
                <p className="mt-2 text-xs tabular-nums">
                  Fazla mesai: {displayDuration(r.overtimeMinutes, r.status)}
                </p>
              )}
            </div>
            <RowActions label={`${r.name} işlemleri`}>
              <DropdownMenuItem
                onClick={() => onShowDetail?.(r.id as Id<"employees">)}
              >
                Gün detayını aç
              </DropdownMenuItem>
            </RowActions>
          </div>
        </li>
      ))}
    </ul>
  );
}
