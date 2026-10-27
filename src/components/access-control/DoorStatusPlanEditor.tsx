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
        Başlangıç (TR saati)
        <Input
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label={`${label} başlangıç`}
          type="time"
          step={1}
          value={value.beginTime}
          onChange={(e) => onChange({ ...value, beginTime: e.target.value })}
        />
      </Label>
      <Label className="space-y-1">
        Bitiş (TR saati)
        <Input
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label={`${label} bitiş`}
          type="time"
          step={1}
          value={value.endTime}
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
          <option value="remainOpen">Sürekli Açık</option>
          <option value="normal">Normal</option>
          <option value="remainClosed">Sürekli Kapalı</option>
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
  const setDay = (
    day: (typeof DOOR_STATUS_DAYS)[number],
    segments: DoorStatusInterval[],
  ) =>
    onChange({
      ...value,
      weekly: DOOR_STATUS_DAYS.map((dayName) => ({
        day: dayName,
        segments:
          dayName === day
            ? segments
            : (value.weekly?.find((entry) => entry.day === dayName)?.segments ??
              []),
      })),
    });
  return (
    <div className="space-y-3">
      <Label className="block space-y-1">
        Plan düzeni
        <NativeSelect
          aria-invalid={invalid}
          aria-describedby={describedBy}
          aria-label="Kapı durum planı düzeni"
          value={value.weekly === undefined ? "daily" : "weekly"}
          onChange={(e) => {
            const { weekly, ...daily } = value;
            onChange(
              e.target.value === "weekly"
                ? {
                    ...daily,
                    weekly: DOOR_STATUS_DAYS.map((day) => ({
                      day,
                      segments: [
                        {
                          beginTime: daily.beginTime,
                          endTime: daily.endTime,
                          mode: daily.mode,
                        },
                      ],
                    })),
                  }
                : {
                    ...daily,
                    ...weekly?.flatMap((entry) => entry.segments)[0],
                  },
            );
          }}
        >
          <option value="daily">Her gün aynı</option>
          <option value="weekly">Gün bazında</option>
        </NativeSelect>
      </Label>
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
          <Button
            type="button"
            variant="outline"
            className="h-auto whitespace-normal"
            onClick={() => {
              const monday =
                value.weekly?.find((entry) => entry.day === "Monday")
                  ?.segments ?? [];
              // Hafta sonu korunur: kapı Cumartesi/Pazar istemeden açık kalmasın.
              const weekdays = new Set(["Tuesday", "Wednesday", "Thursday", "Friday"]);
              onChange({
                ...value,
                weekly: DOOR_STATUS_DAYS.map((day) => ({
                  day,
                  segments: (weekdays.has(day)
                    ? monday
                    : value.weekly?.find((entry) => entry.day === day)?.segments ?? []
                  ).map((segment) => ({ ...segment })),
                })),
              });
            }}
          >
            Pazartesiyi hafta içine (Salı–Cuma) kopyala
          </Button>
          {DOOR_STATUS_DAYS.map((day, dayIndex) => {
            const segments =
              value.weekly?.find((entry) => entry.day === day)?.segments ?? [];
            const label = DAY_LABELS[dayIndex] ?? day;
            return (
              <fieldset key={day} className="space-y-2 rounded-md border p-2">
                <legend className="px-1 text-sm font-medium">{label}</legend>
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
                        beginTime: "08:00:00",
                        endTime: "18:00:00",
                        mode: "remainOpen",
                      },
                    ])
                  }
                >
                  Aralık ekle
                </Button>
              </fieldset>
            );
          })}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Gün başına en fazla 8 aralık. Gece yarısını geçen aralıkları iki güne
        bölün.
      </p>
    </div>
  );
}
