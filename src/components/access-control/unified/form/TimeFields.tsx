
import { Input } from "@/components/ui/input";
import { Clock } from "lucide-react";

interface TimeFieldsProps {
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  isCreating: boolean;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
}

export function TimeFields({
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  isCreating,
  errors,
  setErrors
}: TimeFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <label htmlFor="startTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
          Başlangıç *
        </label>
        <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1">
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (errors.time) setErrors(prev => ({ ...prev, time: "" }));
            }}
            className="border-none bg-transparent px-0 py-0 text-base"
            required
            disabled={isCreating}
          />
          <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="endTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
          Bitiş *
        </label>
        <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1">
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              if (errors.time) setErrors(prev => ({ ...prev, time: "" }));
            }}
            className="border-none bg-transparent px-0 py-0 text-base"
            required
            disabled={isCreating}
          />
          <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
        </div>
        {errors.time && (
          <span className="text-red-500 text-xs">{errors.time}</span>
        )}
      </div>
    </>
  );
}
