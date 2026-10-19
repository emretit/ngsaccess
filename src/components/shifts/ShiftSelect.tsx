import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}

export function ShiftSelect({ id, label, value, onChange, options, placeholder, invalid, describedBy }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="max-w-full min-h-11 sm:min-h-9"
      >
        <SelectValue placeholder={placeholder}>
          {options.find(option => option.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(option => (
          <SelectItem key={option.value} value={option.value} className="min-h-11 sm:min-h-9">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
