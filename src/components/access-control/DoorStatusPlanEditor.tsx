import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import {
  DOOR_STATUS_DAYS,
  DOOR_STATUS_MAX_SEGMENTS,
  type DoorStatusInterval,
  type DoorStatusPlan,
} from "../../../convex/lib/doorStatusPlan";

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
      <Label className="space-y-1">
        Başlangıç
        <Input
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label={`${label} başlangıç`}
          type="time"
          step={hasSeconds(value.beginTime) ? 1 : 60}
          value={
            hasSeconds(value.beginTime)
              ? value.beginTime
              : value.beginTime.slice(0, 5)
          }
          onChange={(e) => onChange({ ...value, beginTime: e.target.value })}
        />
      </Label>
      <Label className="space-y-1">
        Bitiş
        <Input
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label={`${label} bitiş`}
          type="time"
          step={hasSeconds(value.endTime) ? 1 : 60}
          value={
            hasSeconds(value.endTime)
              ? value.endTime
              : value.endTime.slice(0, 5)
          }
          onChange={(e) => onChange({ ...value, endTime: e.target.value })}
        />
      </Label>
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
  const [customLayout, setCustomLayout] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const monday =
    value.weekly?.find((entry) => entry.day === "Monday")?.segments ?? [];
  const weekdays =
    value.weekly !== undefined &&
    DOOR_STATUS_DAYS.every(
      (day, index) =>
        JSON.stringify(
          value.weekly?.find((entry) => entry.day === day)?.segments ?? [],
        ) === JSON.stringify(index < 5 ? monday : []),
    );
  const layout =
    value.weekly === undefined
      ? "daily"
      : weekdays && !customLayout
        ? "weekdays"
        : "weekly";
  const changeLayout = (next: string) => {
    const { weekly, ...daily } = value;
    setLayoutError(null);
    if (next === "weekly") {
      setCustomLayout(true);
      onChange({
        ...value,
        weekly:
          weekly ??
          DOOR_STATUS_DAYS.map((day, index) => ({
            day,
            segments:
              index < 5
                ? [
                    {
                      beginTime: daily.beginTime,
                      endTime: daily.endTime,
                      mode: daily.mode,
                    },
                  ]
                : [],
          })),
      });
      return;
    }
    const base = weekly
      ? monday
      : [
          {
            beginTime: daily.beginTime,
            endTime: daily.endTime,
            mode: daily.mode,
          },
        ];
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
        const oldSegments =
          weekly.find((entry) => entry.day === day)?.segments ?? [];
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
    onChange(
      next === "daily"
        ? { ...daily, ...first }
        : { ...daily, weekly: nextWeek },
    );
  };
  const setDay = (
    day: (typeof DOOR_STATUS_DAYS)[number],
    segments: DoorStatusInterval[],
  ) => {
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
          : (value.weekly?.find((entry) => entry.day === dayName)?.segments ??
            []),
      })),
    });
  };
  return (
    <div className="min-w-0 space-y-3 max-sm:[&_input:not([type=checkbox])]:min-h-11 [&_input]:min-w-0 [&_input]:max-w-full [&_label]:min-w-0 [&_select]:max-w-full max-sm:[&_select]:min-h-11 max-sm:[&_button]:min-h-11">
      <Label className="block space-y-1">
        Plan düzeni
        <NativeSelect
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label="Kapı durum planı düzeni"
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
      {value.weekly === undefined ? (
        <IntervalEditor
          invalid={invalid}
          describedBy={describedBy}
          value={value}
          label="Her gün"
          onChange={(segment) => onChange({ ...value, ...segment })}
        />
      ) : (
        <>
          {DOOR_STATUS_DAYS.map((day, dayIndex) => {
            if (layout === "weekdays" && dayIndex > 0) return null;
            const segments =
              value.weekly?.find((entry) => entry.day === day)?.segments ?? [];
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
                    <IntervalEditor
                      invalid={invalid}
                      describedBy={describedBy}
                      value={segment}
                      label={`${label} ${index + 1}. aralık`}
                      onChange={(next) =>
                        setDay(
                          day,
                          segments.map((item, i) =>
                            i === index ? next : item,
                          ),
                        )
                      }
                    />
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
                  onClick={() =>
                    setDay(day, [
                      ...segments,
                      {
                        beginTime: "08:00",
                        endTime: "18:00",
                        mode: "remainOpen",
                      },
                    ])
                  }
                >
                  Aralık ekle
                </Button>
              </details>
            );
          })}
        </>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm">
          Plan nasıl çalışır?
        </summary>
        <p className="text-xs text-muted-foreground">
          Gün başına en fazla 8 aralık. Gece yarısını geçen aralıkları iki güne
          bölün. Aralık olmayan günlerde kişi yetkileri geçerlidir. Düzen
          değiştirirken Pazartesi aralıkları kullanılır; plan kapatıldığında
          kayıtlı saatler korunur.
        </p>
      </details>
    </div>
  );
}
