import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import {
  DOOR_STATUS_DAYS,
  DOOR_STATUS_MAX_SEGMENTS,
} from "../../../../convex/lib/doorStatusPlan";

/** Shared by the door status and verify-mode plan editors; only the mode field differs. */
type Day = (typeof DOOR_STATUS_DAYS)[number];
type PlanInterval = { beginTime: string; endTime: string };
type WeekDays<I> = { day: Day; segments: I[] }[];
type WeeklyPlan<I> = I & { weekly?: WeekDays<I> };

const DAY_LABELS = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
];
const hasSeconds = (time: string) => time.length > 5 && time.slice(6) !== "00";

/** Başlangıç/Bitiş inputs; the second only shows seconds when a stored time has them. */
export function TimeFields<I extends PlanInterval>({
  value,
  onChange,
  label,
  invalid,
  describedBy,
}: {
  value: I;
  onChange: (value: I) => void;
  label: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <>
      {(["beginTime", "endTime"] as const).map((field) => (
        <Label key={field} className="space-y-1">
          {field === "beginTime" ? "Başlangıç" : "Bitiş"}
          <Input
            aria-invalid={invalid}
            aria-describedby={describedBy}
            aria-label={`${label} ${field === "beginTime" ? "başlangıç" : "bitiş"}`}
            type="time"
            step={hasSeconds(value[field]) ? 1 : 60}
            value={
              hasSeconds(value[field]) ? value[field] : value[field].slice(0, 5)
            }
            onChange={(e) => onChange({ ...value, [field]: e.target.value })}
          />
        </Label>
      ))}
    </>
  );
}

export function useWeeklyPlanLayout<
  I extends PlanInterval,
  P extends WeeklyPlan<I>,
>({
  value,
  onChange,
  toInterval,
  toDaily,
}: {
  value: P;
  onChange: (value: P) => void;
  /** The plan's single-interval fields, used as the weekday template. */
  toInterval: (plan: P) => I;
  /** The plan without `weekly`, with the given interval as its daily hours. */
  toDaily: (plan: P, interval: I) => P;
}) {
  const [customLayout, setCustomLayout] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const segmentsOf = (day: Day) =>
    value.weekly?.find((entry) => entry.day === day)?.segments ?? [];
  const monday = segmentsOf("Monday");
  const weekdays =
    value.weekly !== undefined &&
    DOOR_STATUS_DAYS.every(
      (day, index) =>
        JSON.stringify(segmentsOf(day)) ===
        JSON.stringify(index < 5 ? monday : []),
    );
  const layout =
    value.weekly === undefined
      ? "daily"
      : weekdays && !customLayout
        ? "weekdays"
        : "weekly";
  const changeLayout = (next: string) => {
    const weekly = value.weekly;
    setLayoutError(null);
    if (next === "weekly") {
      setCustomLayout(true);
      onChange({
        ...value,
        weekly:
          weekly ??
          DOOR_STATUS_DAYS.map((day, index) => ({
            day,
            segments: index < 5 ? [toInterval(value)] : [],
          })),
      });
      return;
    }
    const base = weekly ? monday : [toInterval(value)];
    const first = base[0];
    if (next === "daily" && !first) {
      setLayoutError("Önce Pazartesiye en az bir aralık ekleyin.");
      return;
    }
    const nextWeek = DOOR_STATUS_DAYS.map((day, index) => ({
      day,
      segments:
        next === "daily" || index < 5
          ? (next === "daily" ? base.slice(0, 1) : base).map((segment) => ({
              ...segment,
            }))
          : [],
    }));
    const losesData =
      weekly &&
      DOOR_STATUS_DAYS.some((day) => {
        const oldSegments = segmentsOf(day);
        const newSegments =
          nextWeek.find((entry) => entry.day === day)?.segments ?? [];
        return (
          oldSegments.length > 0 &&
          JSON.stringify(oldSegments) !== JSON.stringify(newSegments)
        );
      });
    if (
      losesData &&
      !globalThis.confirm(
        "Farklı günlerdeki aralıklar silinecek. Pazartesi aralıklarıyla devam edilsin mi?",
      )
    )
      return;
    setCustomLayout(false);
    if (next === "daily") {
      if (first) onChange(toDaily(value, first));
    } else onChange({ ...value, weekly: nextWeek });
  };
  const setDay = (day: Day, segments: I[]) => {
    // Günlere göre düzenlerken günler hafta içi kalıbına denk gelse de panel çökmesin.
    if (layout === "weekly") setCustomLayout(true);
    onChange({
      ...value,
      weekly: DOOR_STATUS_DAYS.map((dayName) => ({
        day: dayName,
        segments: (
          layout === "weekdays"
            ? DOOR_STATUS_DAYS.indexOf(dayName) < 5
            : dayName === day
        )
          ? segments
          : segmentsOf(dayName),
      })),
    });
  };
  return { layout, layoutError, changeLayout, setDay, segmentsOf };
}

type IntervalRender<I> = (props: {
  value: I;
  onChange: (value: I) => void;
  label: string;
}) => ReactNode;

/** Plain render helper (not a component) so editors return one expanded element tree. */
export function renderWeeklyPlan<
  I extends PlanInterval,
  P extends WeeklyPlan<I>,
>({
  value,
  onChange,
  plan,
  layoutLabel,
  newInterval,
  renderInterval,
  invalid,
  describedBy,
}: {
  value: P;
  onChange: (value: P) => void;
  plan: ReturnType<typeof useWeeklyPlanLayout<I, P>>;
  layoutLabel: string;
  newInterval: I;
  renderInterval: IntervalRender<I>;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { layout, layoutError, changeLayout, setDay, segmentsOf } = plan;
  return (
    <div className="min-w-0 space-y-3 max-sm:[&_input:not([type=checkbox])]:min-h-11 [&_input]:min-w-0 [&_input]:max-w-full [&_label]:min-w-0 [&_select]:max-w-full max-sm:[&_select]:min-h-11 max-sm:[&_button]:min-h-11">
      <Label className="block space-y-1">
        Plan düzeni
        <NativeSelect
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label={layoutLabel}
          value={layout}
          onChange={(e) => changeLayout(e.target.value)}
        >
          <option value="daily">Her gün</option>
          <option value="weekdays">Hafta içi</option>
          <option value="weekly">Günlere göre</option>
        </NativeSelect>
      </Label>
      {layoutError && (
        <p role="alert" className="text-sm text-destructive">
          {layoutError}
        </p>
      )}
      <p className="text-xs text-muted-foreground">TR saati</p>
      {value.weekly === undefined
        ? renderInterval({
            value,
            label: "Her gün",
            onChange: (segment) => onChange({ ...value, ...segment }),
          })
        : DOOR_STATUS_DAYS.map((day, dayIndex) => {
            if (layout === "weekdays" && dayIndex > 0) return null;
            const segments = segmentsOf(day);
            const label =
              layout === "weekdays"
                ? "Hafta içi"
                : (DAY_LABELS[dayIndex] ?? day);
            return (
              <details
                key={day}
                open={dayIndex === 0 || invalid || undefined}
                className="min-w-0 space-y-2 rounded-md border p-2"
              >
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                  {label} ·{" "}
                  {segments.length
                    ? `${segments.length} aralık`
                    : "Normal çalışır"}
                </summary>
                {segments.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Zaman aralığı yok
                  </p>
                )}
                {segments.map((segment, index) => (
                  <div key={index} className="space-y-2">
                    {renderInterval({
                      value: segment,
                      label: `${label} ${index + 1}. aralık`,
                      onChange: (next) =>
                        setDay(
                          day,
                          segments.map((item, i) =>
                            i === index ? next : item,
                          ),
                        ),
                    })}
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={`${label} ${index + 1}. aralığı sil`}
                      onClick={() =>
                        setDay(
                          day,
                          segments.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Aralığı sil
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={segments.length >= DOOR_STATUS_MAX_SEGMENTS}
                  aria-label={`${label} aralık ekle`}
                  onClick={() => setDay(day, [...segments, { ...newInterval }])}
                >
                  Aralık ekle
                </Button>
              </details>
            );
          })}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm">
          Plan nasıl çalışır?
        </summary>
        <p className="text-xs text-muted-foreground">
          {`Gün başına en fazla ${DOOR_STATUS_MAX_SEGMENTS} aralık. Gece yarısını geçen aralıkları iki güne bölün. Aralık olmayan günlerde kişi yetkileri geçerlidir. Düzen değiştirirken Pazartesi aralıkları kullanılır; plan kapatıldığında kayıtlı saatler korunur.`}
        </p>
      </details>
    </div>
  );
}
