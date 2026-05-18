import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WEEKDAYS } from "./weekdays";

interface TimeScheduleFormData {
  start_time: string;
  end_time: string;
  days: string[];
}

interface TimeScheduleProps<T extends TimeScheduleFormData = TimeScheduleFormData> {
  formData: T;
  setFormData: (updater: (prev: T) => T) => void;
}

export const TimeSchedule = <T extends TimeScheduleFormData,>({ formData, setFormData }: TimeScheduleProps<T>) => {
  return (
    <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
      <div role="group" aria-labelledby="saat-label" className="space-y-1.5">
        <Label id="saat-label">Saat</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id="start_time"
            type="time"
            aria-label="Başlangıç saati"
            value={formData.start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
          />
          <Input
            id="end_time"
            type="time"
            aria-label="Bitiş saati"
            value={formData.end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Hangi Günlerde?</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={formData.days}
          onValueChange={(days) => setFormData(prev => ({ ...prev, days }))}
          className="justify-start gap-1.5"
        >
          {WEEKDAYS.map((day) => (
            <ToggleGroupItem
              key={day.value}
              value={day.value}
              title={day.full}
              className="h-9 w-10 p-0 text-sm font-medium"
            >
              {day.short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
};
