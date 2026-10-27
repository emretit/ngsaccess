import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import type { VerifyPlan } from "../../../../convex/lib/doorStatusPlan";
import {
  renderWeeklyPlan,
  TimeFields,
  useWeeklyPlanLayout,
} from "./weeklyPlan";

type VerifyInterval = Pick<VerifyPlan, "beginTime" | "endTime" | "verifyMode">;
const VERIFY_MODES = [
  ["card", "Kart"],
  ["face", "Yüz"],
  ["fp", "Parmak İzi"],
  ["cardOrFace", "Kart veya Yüz"],
  ["cardAndPw", "Kart + Şifre"],
  ["faceAndCard", "Kart + Yüz"],
] as const;
function IntervalEditor({
  value,
  onChange,
  label,
  invalid,
  describedBy,
}: {
  value: VerifyInterval;
  onChange: (value: VerifyInterval) => void;
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
          value={value.verifyMode}
          onChange={(e) => onChange({ ...value, verifyMode: e.target.value })}
        >
          {VERIFY_MODES.map(([mode, text]) => (
            <option key={mode} value={mode}>
              {text}
            </option>
          ))}
          {!VERIFY_MODES.some(([mode]) => mode === value.verifyMode) && (
            <option value={value.verifyMode}>{value.verifyMode}</option>
          )}
        </NativeSelect>
      </Label>
    </div>
  );
}

export function DoorVerifyPlanEditor({
  value,
  onChange,
  invalid,
  "aria-describedby": describedBy,
}: {
  value: VerifyPlan;
  onChange: (value: VerifyPlan) => void;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  const plan = useWeeklyPlanLayout<VerifyInterval, VerifyPlan>({
    value,
    onChange,
    toInterval: ({ beginTime, endTime, verifyMode }) => ({
      beginTime,
      endTime,
      verifyMode,
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
    layoutLabel: "Doğrulama planı düzeni",
    newInterval: { beginTime: "08:00", endTime: "18:00", verifyMode: "card" },
    renderInterval: (props) => (
      <IntervalEditor {...props} invalid={invalid} describedBy={describedBy} />
    ),
    invalid,
    describedBy,
  });
}
