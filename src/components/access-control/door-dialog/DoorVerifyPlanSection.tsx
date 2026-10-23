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
      className="rounded-md border p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <Label htmlFor="verify-enabled">Doğrulama Modu Planı</Label>
        <Switch
          id="verify-enabled"
          checked={verifyPlan.enabled}
          onCheckedChange={(enabled) =>
            setVerifyPlan((p) => ({ ...p, enabled }))
          }
        />
      </div>
      <div
        id="verify-plan"
        tabIndex={-1}
        aria-invalid={!!timeErrors["verify-plan"]}
      >
        <DoorVerifyPlanEditor value={verifyPlan} onChange={setVerifyPlan} />
        {timeErrors["verify-plan"] && (
          <p role="alert" className="text-sm text-destructive">
            {timeErrors["verify-plan"]}
          </p>
        )}
      </div>
    </fieldset>
  );
}
