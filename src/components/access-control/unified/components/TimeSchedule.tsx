
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
  const handleDayChange = (day: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      days: checked 
        ? [...prev.days, day]
        : prev.days.filter((d: string) => d !== day)
    }));
  };

  const weekDays = [
    { value: 'Monday', label: 'Pazartesi' },
    { value: 'Tuesday', label: 'Salı' },
    { value: 'Wednesday', label: 'Çarşamba' },
    { value: 'Thursday', label: 'Perşembe' },
    { value: 'Friday', label: 'Cuma' },
    { value: 'Saturday', label: 'Cumartesi' },
    { value: 'Sunday', label: 'Pazar' },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_time">Başlangıç Saati</Label>
          <Input
            id="start_time"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_time">Bitiş Saati</Label>
          <Input
            id="end_time"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Hangi Günlerde?</Label>
        <div className="grid grid-cols-4 gap-2">
          {weekDays.map((day) => (
            <div key={day.value} className="flex items-center space-x-2">
              <Checkbox
                id={`day-${day.value}`}
                checked={formData.days.includes(day.value)}
                onCheckedChange={(checked) => 
                  handleDayChange(day.value, checked as boolean)
                }
              />
              <Label 
                htmlFor={`day-${day.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {day.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
