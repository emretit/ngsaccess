
import { Button } from "@/components/ui/button";

interface DaysSelectorProps {
  days: string[];
  setDays: (days: string[]) => void;
  isCreating: boolean;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
}

const DAYS = [
  { key: "paz", label: "Paz" },
  { key: "sal", label: "Sal" },
  { key: "çar", label: "Çar" },
  { key: "per", label: "Per" },
  { key: "cum", label: "Cum" },
  { key: "cmt", label: "Cmt" },
  { key: "pzr", label: "Pzr" },
];

export function DaysSelector({
  days,
  setDays,
  isCreating,
  errors,
  setErrors
}: DaysSelectorProps) {
  function handleToggleDay(day: string) {
    const newDays = days.includes(day) 
      ? days.filter((x) => x !== day) 
      : [...days, day];
    setDays(newDays);
    if (errors.days) setErrors(prev => ({ ...prev, days: "" }));
  }

  return (
    <div className="md:col-span-3 flex flex-col gap-2 mt-2">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">
        Günler *
      </label>
      <div className="flex gap-2 flex-wrap">
        {DAYS.map((day) => (
          <Button
            key={day.key}
            type="button"
            variant={days.includes(day.key) ? "default" : "outline"}
            onClick={() => handleToggleDay(day.key)}
            className={`rounded-full min-w-[38px] px-3 py-1 text-sm transition-all ${
              days.includes(day.key) ? "bg-primary text-white shadow" : ""
            }`}
            disabled={isCreating}
          >
            {day.label}
          </Button>
        ))}
      </div>
      {errors.days && (
        <span className="text-red-500 text-xs">{errors.days}</span>
      )}
    </div>
  );
}
