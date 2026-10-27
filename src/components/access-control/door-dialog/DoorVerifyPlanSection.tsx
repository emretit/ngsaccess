import type { Dispatch, SetStateAction } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DoorVerifyPlanEditor } from "./DoorVerifyPlanEditor";
import type { VerifyPlan } from "../../../../convex/lib/doorStatusPlan";
export type VerifyPlanState = VerifyPlan;
export function DoorVerifyPlanSection({
  verifyPlan,
  setVerifyPlan,
  isSubmitting,
  saved,
  timeErrors,
}: {
  verifyPlan: VerifyPlanState;
  setVerifyPlan: Dispatch<SetStateAction<VerifyPlanState>>;
  isSubmitting: boolean;
  saved: boolean;
  timeErrors: Record<string, string>;
}) {
  return (
    <fieldset
      disabled={isSubmitting || saved}
      className="min-w-0 rounded-md border p-3 space-y-3"
    >
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Label htmlFor="verify-enabled">Doğrulama Modu Planı</Label>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm">
            {verifyPlan.enabled ? "Açık" : "Kapalı"}
          </span>
          <Switch
            id="verify-enabled"
            checked={verifyPlan.enabled}
            onCheckedChange={(enabled) =>
              setVerifyPlan((p) => ({ ...p, enabled }))
            }
          />
        </div>
      </div>
      {verifyPlan.enabled ? (
        <div
          id="verify-plan"
          tabIndex={-1}
          aria-invalid={!!timeErrors["verify-plan"]}
        >
          <p className="text-xs text-muted-foreground">
            Saatler dışında kişi yetkileri geçerlidir.
          </p>
          <DoorVerifyPlanEditor
            value={verifyPlan}
            onChange={setVerifyPlan}
            invalid={Boolean(timeErrors["verify-plan"])}
            aria-describedby={
              timeErrors["verify-plan"] ? "verify-plan-error" : undefined
            }
          />
          {timeErrors["verify-plan"] && (
            <p
              id="verify-plan-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {timeErrors["verify-plan"]}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm">
          Plan etkin değil. Geçerli doğrulama yöntemi kullanılır; kayıtlı
          saatler korunur.
        </p>
      )}
    </fieldset>
  );
}
