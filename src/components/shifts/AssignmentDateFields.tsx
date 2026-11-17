import { DateInput } from "@/components/ui/date-picker";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { OPEN_SHIFT_END } from "../../../convex/lib/shiftRange";

export function AssignmentDateFields({ idPrefix, startDate, endDate, onChange, errors }: {
  idPrefix: string;
  startDate: string;
  endDate: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
  errors?: { startDate?: string; endDate?: string };
}) {
  const unlimited = endDate === OPEN_SHIFT_END;
  return <div className="space-y-2">
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
      <FormFieldWrapper htmlFor={`${idPrefix}-start`} label="Başlangıç" error={errors?.startDate}>
        <DateInput required value={startDate} onChange={date => onChange({ startDate: date, endDate })} />
      </FormFieldWrapper>
      <FormFieldWrapper htmlFor={`${idPrefix}-end`} label="Bitiş" error={errors?.endDate}>
        <DateInput required={!unlimited} disabled={unlimited} value={unlimited ? "" : endDate} placeholder={unlimited ? "Süresiz" : "Tarih seçin"}
          onChange={date => onChange({ startDate, endDate: date })} />
      </FormFieldWrapper>
    </div>
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-primary" checked={unlimited}
        onChange={event => onChange({ startDate, endDate: event.target.checked ? OPEN_SHIFT_END : startDate })} />
      Süresiz
    </label>
  </div>;
}
