import { DAYS } from "./lib/planning";

type Weekday = (typeof DAYS)[number][0];
interface Props {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
  error?: string;
  id: string;
}

export function WeekdaySelection({ value, onChange, error, id }: Props) {
  return (
    <fieldset
      role="group"
      aria-describedby={error ? `${id}-error` : undefined}
      tabIndex={error ? -1 : undefined}
    >
      <legend className="text-sm mb-2">Uygulanacak günler</legend>
      <div className="flex flex-wrap gap-3">
        {DAYS.map(([code, label]) => (
          <label key={code} className="flex min-h-11 gap-1 items-center text-sm">
            <input
              type="checkbox"
              className="size-6 shrink-0 accent-primary"
              checked={value.includes(code)}
              onChange={() => onChange(value.includes(code) ? value.filter(day => day !== code) : [...value, code])}
            />
            {label}
          </label>
        ))}
      </div>
      {error && <p role="alert" id={`${id}-error`} className="text-danger text-xs">{error}</p>}
    </fieldset>
  );
}
