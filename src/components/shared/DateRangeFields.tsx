import { DateInput } from "@/components/ui/date-picker";
import { FieldError, FormFieldWrapper } from "./FormFieldWrapper";

export type DateRangeValue = { start: string; end: string };
export type DateRangeField = keyof DateRangeValue;

type DateRangeFieldsProps = {
  /** Alan id'leri `${idPrefix}-start` / `${idPrefix}-end` olur. */
  idPrefix: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue, changed: DateRangeField) => void;
  errors?: { start?: string; end?: string; range?: string };
  labels?: { start: string; end: string };
  disabled?: boolean;
  required?: boolean;
  /** Her seçicinin min/max'ı diğer alanı izler; ters aralık seçilemez. */
  constrainOrder?: boolean;
  layout?: "stack" | "row";
  className?: string;
};

/** Başlangıç/bitiş tarih çifti; tarih dönüşümü, gün sayısı ve aralık kuralları çağıranda kalır. */
export function DateRangeFields({
  idPrefix, value, onChange, errors, labels = { start: "Başlangıç tarihi", end: "Bitiş tarihi" },
  disabled, required, constrainOrder = false, layout = "stack", className,
}: DateRangeFieldsProps) {
  const rangeErrorId = `${idPrefix}-range-error`;
  const rangeProps = errors?.range ? { "aria-invalid": true, "aria-describedby": rangeErrorId } : {};
  return (
    <div className={className}>
      <div className={layout === "row" ? "grid grid-cols-1 gap-3 min-[400px]:grid-cols-2" : "space-y-4"}>
        <FormFieldWrapper htmlFor={`${idPrefix}-start`} label={labels.start} error={errors?.start}>
          <DateInput
            {...rangeProps}
            className="min-w-0 max-w-full"
            required={required}
            disabled={disabled}
            value={value.start}
            max={constrainOrder && value.end ? value.end : undefined}
            onChange={start => onChange({ ...value, start }, "start")}
          />
        </FormFieldWrapper>
        <FormFieldWrapper htmlFor={`${idPrefix}-end`} label={labels.end} error={errors?.end}>
          <DateInput
            {...rangeProps}
            className="min-w-0 max-w-full"
            required={required}
            disabled={disabled}
            value={value.end}
            min={constrainOrder && value.start ? value.start : undefined}
            onChange={end => onChange({ ...value, end }, "end")}
          />
        </FormFieldWrapper>
      </div>
      <FieldError id={rangeErrorId} message={errors?.range} />
    </div>
  );
}
