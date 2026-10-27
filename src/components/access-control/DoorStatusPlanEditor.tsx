import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import type {
  DoorStatusInterval,
  DoorStatusPlan,
} from "../../../convex/lib/doorStatusPlan";
import {
  renderWeeklyPlan,
  TimeFields,
  useWeeklyPlanLayout,
} from "./door-dialog/weeklyPlan";

function IntervalEditor({
  value,
  onChange,
  label,
  invalid,
  describedBy,
}: {
  value: DoorStatusInterval;
  onChange: (value: DoorStatusInterval) => void;
  label: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <TimeFields
        value={value}
        onChange={onChange}
        label={label}
        invalid={invalid}
        describedBy={describedBy}
      />
      <Label className="space-y-1">
        Mod
        <NativeSelect
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label={`${label} mod`}
          value={value.mode}
          onChange={(e) => {
            const mode = e.target.value;
            if (
              mode === "remainOpen" ||
              mode === "remainClosed" ||
              mode === "normal"
            )
              onChange({ ...value, mode });
          }}
        >
          <option value="remainOpen">Sürekli açık</option>
          <option value="normal">Normal</option>
          <option value="remainClosed">Sürekli kilitli</option>
        </NativeSelect>
      </Label>
    </div>
  );
}

export function DoorStatusPlanEditor({
  value,
  onChange,
  invalid,
  "aria-describedby": describedBy,
}: {
  value: DoorStatusPlan;
  onChange: (value: DoorStatusPlan) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  const plan = useWeeklyPlanLayout<DoorStatusInterval, DoorStatusPlan>({
    value,
    onChange,
    toInterval: ({ beginTime, endTime, mode }) => ({
      beginTime,
      endTime,
      mode,
    }),
    toDaily: ({ weekly: _weekly, ...daily }, interval) => ({
      ...daily,
      ...interval,
    }),
  });
  return renderWeeklyPlan({
    value,
    onChange,
    plan,
    layoutLabel: "Kapı durum planı düzeni",
    newInterval: { beginTime: "08:00", endTime: "18:00", mode: "remainOpen" },
    renderInterval: (props) => (
      <IntervalEditor {...props} invalid={invalid} describedBy={describedBy} />
    ),
    invalid,
    describedBy,
  });
}
