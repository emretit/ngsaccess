import { ChevronRight, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";

interface MobileEmployeeRecord {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  status: "present" | "late" | "absent" | "leave";
  isLate?: boolean;
  isEarlyExit?: boolean;
  isManual?: boolean;
}

const STATUS_META: Record<
  MobileEmployeeRecord["status"],
  { label: string; className: string }
> = {
  present: { label: "Mevcut", className: "bg-green-100 text-green-800 border-green-200" },
  late: { label: "Geç", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  absent: { label: "Yok", className: "bg-red-100 text-red-800 border-red-200" },
  leave: { label: "İzinli", className: "bg-blue-100 text-blue-800 border-blue-200" },
};

interface PDKSMobileCardListProps {
  records: MobileEmployeeRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onShowDetail?: (employeeId: Id<"employees">) => void;
  onEdit?: (record: MobileEmployeeRecord) => void;
  canEdit?: boolean;
}

export function PDKSMobileCardList({
  records,
  selectedIds,
  onToggleSelect,
  onShowDetail,
  onEdit,
  canEdit,
}: PDKSMobileCardListProps) {
  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Bu filtre için kayıt yok.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const status = STATUS_META[record.status];
        const selected = selectedIds.has(record.id);
        return (
          <div
            key={record.id}
            className={cn(
              "rounded-lg border bg-card p-3 transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <div className="flex items-start gap-3">
              <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(record.id)}
                  aria-label={`${record.name} seç`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onShowDetail?.(record.id as Id<"employees">)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">{record.name}</span>
                      {record.isManual && (
                        <span className="text-purple-600 text-xs" title="Manuel düzeltme">
                          ✏️
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {record.department} · {record.employeeId}
                    </div>
                  </button>
                  <Badge className={cn(status.className, "border text-[10px] shrink-0")}>
                    {status.label}
                  </Badge>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <div className="text-muted-foreground">Giriş</div>
                    <div className="font-mono">{record.firstEntry}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Çıkış</div>
                    <div className="font-mono">{record.lastExit}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Toplam</div>
                    <div className="font-semibold text-green-700">{record.totalHours}</div>
                  </div>
                </div>

                {record.isEarlyExit && (
                  <Badge className="bg-orange-100 text-orange-800 border-orange-200 border text-[10px] mt-2">
                    Erken Çıkış
                  </Badge>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
                  {canEdit && onEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => onEdit(record)}
                    >
                      <Pencil className="h-3 w-3" />
                      Düzelt
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs ml-auto"
                    onClick={() => onShowDetail?.(record.id as Id<"employees">)}
                  >
                    Detay
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
