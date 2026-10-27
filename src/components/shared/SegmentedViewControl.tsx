import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SegmentedViewControlProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedViewControl<T extends string>({
  label, value, options, onChange, className,
}: SegmentedViewControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map(option => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "secondary" : "ghost"}
          aria-pressed={value === option.value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
