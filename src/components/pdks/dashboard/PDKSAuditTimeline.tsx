import { useQuery } from "convex/react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { History } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const ACTION_LABEL: Record<string, string> = {
  create: "oluşturdu",
  update: "güncelledi",
  delete: "sildi",
};

interface PDKSAuditTimelineProps {
  employeeId: Id<"employees">;
  startDate: string;
  endDate: string;
}

export function PDKSAuditTimeline({
  employeeId,
  startDate,
  endDate,
}: PDKSAuditTimelineProps) {
  const events = useQuery(api.auditLog.getPdksAuditForEmployee, {
    employeeId,
    startDate,
    endDate,
  });

  if (events === undefined) {
    return (
      <div className="text-xs text-muted-foreground py-2">Yükleniyor...</div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Bu dönem için manuel düzeltme kaydı yok.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div
          key={e.id}
          className="border-l-2 border-primary/40 pl-3 py-1 text-xs"
        >
          <div className="flex items-center gap-2 text-foreground">
            <History className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{e.userName}</span>
            <span className="text-muted-foreground">
              {ACTION_LABEL[e.action] ?? e.action}
            </span>
            {e.date && (
              <span className="text-muted-foreground">— {e.date}</span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {format(new Date(e.timestamp), "dd MMM yyyy HH:mm", { locale: tr })}
          </div>
          {e.oldValue && e.newValue && (
            <div className="mt-1 text-[10px] space-y-0.5">
              {e.oldValue.entryTime !== e.newValue.entryTime && (
                <div>
                  Giriş: <span className="line-through">{e.oldValue.entryTime ?? "—"}</span>{" "}
                  → <span className="font-medium">{e.newValue.entryTime ?? "—"}</span>
                </div>
              )}
              {e.oldValue.exitTime !== e.newValue.exitTime && (
                <div>
                  Çıkış: <span className="line-through">{e.oldValue.exitTime ?? "—"}</span>{" "}
                  → <span className="font-medium">{e.newValue.exitTime ?? "—"}</span>
                </div>
              )}
            </div>
          )}
          {e.note && (
            <div className="mt-1 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-0.5 inline-block">
              {e.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
