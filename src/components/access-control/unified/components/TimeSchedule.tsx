import { changeScheduleMode } from "../templates/model";
import { Button } from "@/components/ui/button";
import { TemplatePicker } from "../templates/TemplatePicker";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WEEKDAYS, sortWeekdays } from "./weekdays";
interface TimeScheduleFormData {
  scheduleMode?: "custom" | "template";
  scheduleTemplateId?: string;
  start_time: string;
  end_time: string;
  days: string[];
}
interface Props<T extends TimeScheduleFormData> {
  currentTemplateId?: string;
  onEditTemplate?: (navigate: () => void) => void;
  errors?: Record<string, string>;
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}
export const TimeSchedule = <T extends TimeScheduleFormData>({
  formData,
  setFormData,
  errors = {},
  currentTemplateId,
  onEditTemplate,
}: Props<T>) => {
  const [range, setRange] = useState(
    Boolean(formData.start_time || formData.end_time),
  );
  return (
    <div className="space-y-4 border-t pt-4 min-w-0">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Zaman kaynağı"
      >
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-pressed={formData.scheduleMode !== "template"}
          onClick={() =>
            setFormData((prev) => changeScheduleMode(prev, "custom"))
          }
        >
          Özel saat
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-pressed={formData.scheduleMode === "template"}
          onClick={() =>
            setFormData((prev) => changeScheduleMode(prev, "template"))
          }
        >
          Şablon kullan
        </Button>
      </div>
      {formData.scheduleMode === "template" ? (
        <>
          <TemplatePicker
            value={formData.scheduleTemplateId ?? ""}
            currentTemplateId={currentTemplateId}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, scheduleTemplateId: value }))
            }
            onEdit={onEditTemplate}
          />
          {errors.scheduleTemplateId && (
            <p role="alert" className="text-danger">
              {errors.scheduleTemplateId}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Türkiye saati (Europe/Istanbul). Geceyi aşan planlar için ayrı
            kurallar oluşturun.
          </p>
          <fieldset className="space-y-2">
            <legend className="font-medium">Saat kapsamı</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="time-mode"
                  checked={!range}
                  onChange={() => {
                    setRange(false);
                    setFormData((prev) => ({
                      ...prev,
                      start_time: "",
                      end_time: "",
                    }));
                  }}
                />
                Tüm gün
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="time-mode"
                  checked={range}
                  onChange={() => setRange(true)}
                />
                Saat aralığı
              </label>
            </div>
            {range && (
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                {[
                  {
                    key: "start_time",
                    label: "Başlangıç",
                    error: errors.startTime,
                  },
                  { key: "end_time", label: "Bitiş", error: errors.endTime },
                ].map((field) => (
                  <div key={field.key} className="min-w-0 space-y-1">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <Input
                      id={field.key}
                      type="time"
                      className="min-w-0 w-full"
                      aria-invalid={!!field.error}
                      aria-describedby={
                        field.error ? "rule-time-error" : undefined
                      }
                      value={
                        field.key === "start_time"
                          ? formData.start_time
                          : formData.end_time
                      }
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            {(errors.startTime || errors.endTime) && (
              <p
                id="rule-time-error"
                role="alert"
                className="text-xs text-danger"
              >
                {errors.startTime || errors.endTime}
              </p>
            )}
          </fieldset>
          <div id="rule-days" tabIndex={-1} className="space-y-2">
            <Label>İzin verilen günler</Label>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={formData.days}
              onValueChange={(days) =>
                setFormData((prev) => ({ ...prev, days: sortWeekdays(days) }))
              }
              aria-label="İzin verilen günler"
              aria-invalid={!!errors.days}
              aria-describedby={errors.days ? "rule-days-error" : undefined}
              className="justify-start flex-wrap gap-1.5"
            >
              {WEEKDAYS.map((day) => (
                <ToggleGroupItem
                  key={day.value}
                  value={day.value}
                  aria-label={day.full}
                  className="h-11 w-10 border-input bg-background p-0 text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground"
                >
                  {day.short}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {errors.days && (
              <p
                id="rule-days-error"
                role="alert"
                className="text-xs text-danger"
              >
                {errors.days}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
