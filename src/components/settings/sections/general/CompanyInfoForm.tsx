import { NativeSelect } from "@/components/ui/native-select";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { GeneralValues } from "./generalForm";

export function CompanyInfoForm({ values, change, errors }: {
  values: GeneralValues; change: (fields: Partial<GeneralValues>) => void;
  errors: Partial<Record<keyof GeneralValues, string>>;
}) {
  return <div className="grid min-w-0 grid-cols-1 gap-4 min-[761px]:grid-cols-2">
    {([
      ["companyName", "Şirket adı *", "text"], ["taxNumber", "Vergi numarası", "text"],
      ["address", "Adres", "text"], ["email", "E-posta", "email"], ["phone", "Telefon", "tel"],
      ["website", "Web sitesi", "text"],
    ] as const).map(([key, label, type]) => <FormFieldWrapper key={key} htmlFor={key} label={label} error={errors[key]} className={key === "address" ? "min-[761px]:col-span-2" : undefined}>
      {key === "address" ? <Textarea name={key} value={values[key]} onChange={e => change({ [key]: e.target.value })} /> :
        <Input name={key} type={type} value={values[key]} required={key === "companyName"} onChange={e => change({ [key]: e.target.value })} />}
    </FormFieldWrapper>)}
    <FormFieldWrapper htmlFor="currency" label="Para birimi" error={errors.currency}>
      <NativeSelect name="currency" value={values.currency} onChange={e => change({ currency: e.target.value })} className="w-full">
        <option value="TRY">Türk Lirası (₺)</option><option value="USD">ABD Doları ($)</option><option value="EUR">Euro (€)</option>
      </NativeSelect>
    </FormFieldWrapper>
  </div>;
}
