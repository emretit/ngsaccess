import { Checkbox } from "@/components/ui/checkbox";

export type ListSelectAllProps = {
  label: string;
  checked: boolean | "indeterminate";
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export function ListSelectAll({ label, checked, onChange, disabled }: ListSelectAllProps) {
  return (
    <Checkbox
      aria-label={label}
      className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:before:absolute data-[state=indeterminate]:before:inset-x-[3px] data-[state=indeterminate]:before:top-1/2 data-[state=indeterminate]:before:h-0.5 data-[state=indeterminate]:before:-translate-y-1/2 data-[state=indeterminate]:before:bg-current data-[state=indeterminate]:before:content-[''] [&[data-state=indeterminate]_svg]:hidden"
      disabled={disabled}
      checked={checked}
      onCheckedChange={value => onChange(value === true)}
    />
  );
}
