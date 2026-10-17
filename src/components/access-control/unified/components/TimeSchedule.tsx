import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WEEKDAYS, sortWeekdays } from "./weekdays";

interface TimeScheduleFormData {
  start_time: string;
  end_time: string;
  days: string[];
}

interface TimeScheduleProps<T extends TimeScheduleFormData = TimeScheduleFormData> {
  errors?: Record<string, string>;
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}

export const TimeSchedule = <T extends TimeScheduleFormData,>({ formData, setFormData, errors = {} }: TimeScheduleProps<T>) => {
  return (
    <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
      <div role="group" aria-labelledby="saat-label" className="space-y-1.5">
        <Label id="saat-label">Saat</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => setFormData(prev => ({ ...prev, start_time: "", end_time: "" }))}>Tüm gün</Button>
        <p className="text-xs text-muted-foreground">İki saat de boşsa tüm gün. Geceyi aşan planlar ayrı kurallar gerektirir.</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="start_time"
            type="time"
            aria-label="Başlangıç saati"
            aria-invalid={!!errors.startTime}
            aria-describedby={errors.startTime ? "rule-time-error" : undefined}
            value={formData.start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
          />
          <Input
            id="end_time"
            type="time"
            aria-label="Bitiş saati"
            aria-invalid={!!errors.endTime}
            aria-describedby={errors.endTime ? "rule-time-error" : undefined}
            value={formData.end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
          />
        </div>
        {(errors.startTime || errors.endTime) && <p id="rule-time-error" role="alert" className="text-sm text-destructive">{errors.startTime || errors.endTime}</p>}
      </div>

      <div className="space-y-1.5" id="rule-days" tabIndex={-1}>
        <Label>Hangi Günlerde?</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={formData.days}
          onValueChange={(days) => setFormData(prev => ({ ...prev, days: sortWeekdays(days) }))}
          aria-label="İzin verilen günler"
          className="justify-start flex-wrap gap-1.5"
        >
          {WEEKDAYS.map((day) => (
            <ToggleGroupItem
              key={day.value}
              value={day.value}
              title={day.full}
              aria-label={day.full}
              className="h-9 w-10 p-0 text-sm font-medium"
            >
              {day.short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {errors.days && <p role="alert" className="text-sm text-destructive">{errors.days}</p>}
      </div>
    </div>
  );
};
