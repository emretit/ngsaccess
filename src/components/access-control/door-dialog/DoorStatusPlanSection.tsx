import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { DoorStatusPlan } from "../../../../convex/lib/doorStatusPlan";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function DoorStatusPlanSection({
  statusPlan,
  setStatusPlan,
  isSubmitting,
  saved,
  children,
}: {
  statusPlan: DoorStatusPlan;
  setStatusPlan: Dispatch<SetStateAction<DoorStatusPlan>>;
  isSubmitting: boolean;
  saved: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border p-3 space-y-3">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Label htmlFor="status-enabled" className="text-sm font-medium">
          Kapı Durum Planı
        </Label>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm">
            {statusPlan.enabled ? "Açık" : "Kapalı"}
          </span>
          <Switch
            disabled={isSubmitting || saved}
            id="status-enabled"
            checked={statusPlan.enabled}
            onCheckedChange={(enabled) =>
              setStatusPlan((p) => ({ ...p, enabled }))
            }
          />
        </div>
      </div>
      {statusPlan.enabled ? (
        <>
          <p className="text-xs text-muted-foreground">
            Saatler dışında kişi yetkileri geçerlidir.
          </p>
          {children}
        </>
      ) : (
        <p className="text-sm">
          Plan etkin değil. Kapı normal çalışır; kayıtlı saatler korunur.
        </p>
      )}
    </div>
  );
}
