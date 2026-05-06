import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RuleConflict } from "@/types/access-control";
import { AlertTriangle, Clock } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { EnhancedRuleFormData } from "./useEnhancedRuleForm";

const WEEK_DAYS: Array<{ value: string; label: string }> = [
  { value: "Monday", label: "Pazartesi" },
  { value: "Tuesday", label: "Salı" },
  { value: "Wednesday", label: "Çarşamba" },
  { value: "Thursday", label: "Perşembe" },
  { value: "Friday", label: "Cuma" },
  { value: "Saturday", label: "Cumartesi" },
  { value: "Sunday", label: "Pazar" },
];

interface ScheduleTabProps {
  formData: EnhancedRuleFormData;
  setFormData: Dispatch<SetStateAction<EnhancedRuleFormData>>;
  conflicts: RuleConflict[];
}

export function ScheduleTab({ formData, setFormData, conflicts }: ScheduleTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Zaman Ayarları</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start_time">Başlangıç Saati</Label>
            <Input
              id="start_time"
              type="time"
              value={formData.startTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, startTime: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_time">Bitiş Saati</Label>
            <Input
              id="end_time"
              type="time"
              value={formData.endTime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, endTime: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Günler</Label>
          <div className="grid grid-cols-4 gap-2">
            {WEEK_DAYS.map((day) => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.value}`}
                  checked={formData.days.includes(day.value)}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      days: checked
                        ? [...prev.days, day.value]
                        : prev.days.filter((d) => d !== day.value),
                    }))
                  }
                />
                <Label
                  htmlFor={`day-${day.value}`}
                  className="text-sm cursor-pointer"
                >
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-700">Çakışma Tespit Edildi</span>
            </div>
            <div className="space-y-2">
              {conflicts.map((conflict, index) => (
                <div key={index} className="text-sm text-red-600">
                  {conflict.conflictDescription}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
