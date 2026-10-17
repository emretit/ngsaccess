import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/shared/FormFieldWrapper";
import type { EmployeeFormData } from "./hooks/useEmployeeFormData";
interface Option {
  id: string;
  name: string;
}
interface Props {
  formData: EmployeeFormData;
  setFormData: (data: EmployeeFormData) => void;
  companies: Option[];
  departments: Option[];
  accessRules: Option[];
  positions: Option[];
  errors?: Partial<Record<string, string>>;
  photo?: ReactNode;
}
export default function EmployeeFormFields({
  formData,
  setFormData,
  companies,
  departments,
  accessRules,
  positions,
  errors = {},
  photo,
}: Props) {
  const [otherOpen, setOtherOpen] = useState(false);
  useEffect(() => {
    if (errors.hourlyRate || errors.monthlySalary) setOtherOpen(true);
  }, [errors.hourlyRate, errors.monthlySalary]);
  const update = <K extends keyof EmployeeFormData>(
    key: K,
    value: EmployeeFormData[K],
  ) => setFormData({ ...formData, [key]: value });
  const input = (
    key:
      | "firstName"
      | "lastName"
      | "email"
      | "cardNumber"
      | "tcNo"
      | "payrollCode",
    label: string,
    type = "text",
  ) => (
    <div>
      <Label htmlFor={`employee-${key}`}>{label}</Label>
      <Input
        id={`employee-${key}`}
        name={key}
        type={type}
        required={["firstName", "lastName", "email", "cardNumber"].includes(
          key,
        )}
        value={formData[key]}
        onChange={(e) => update(key, e.target.value)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `employee-${key}-error` : undefined}
        maxLength={key === "tcNo" ? 11 : undefined}
      />
      <FieldError id={`employee-${key}-error`} message={errors[key]} />
    </div>
  );
  const select = (
    key: "companyId" | "departmentId" | "positionId" | "accessRuleId",
    label: string,
    options: Option[],
  ) => (
    <div>
      <Label htmlFor={`employee-${key}`}>{label}</Label>
      <select
        id={`employee-${key}`}
        name={key}
        className="mt-1 h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
        value={formData[key] ?? ""}
        onChange={(e) =>
          update(key, (e.target.value || null) as EmployeeFormData[typeof key])
        }
      >
        <option value="">
          {key === "accessRuleId" ? "Yeni kural ekleme" : "Atanmamış"}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
  const section = (title: string, children: ReactNode) => (
    <fieldset className="min-w-0 space-y-4 border-t pt-5">
      <legend className="text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
  return (
    <div className="min-w-0 space-y-6">
      {section(
        "Kimlik",
        <div className="grid gap-4 sm:grid-cols-2">
          {input("firstName", "Ad *")}
          {input("lastName", "Soyad *")}
        </div>,
      )}
      {section(
        "İletişim",
        <>
          {input("email", "E-posta *", "email")}
          <p className="text-xs text-muted-foreground">
            Mobil giriş kurulum bağlantısı bu adrese gönderilir.
          </p>
        </>,
      )}
      {section(
        "Organizasyon",
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {select("companyId", "Şirket", companies)}
            {select("departmentId", "Departman", departments)}
            {select("positionId", "Pozisyon", positions)}
          </div>
          <Label htmlFor="employee-isActive" className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox
              id="employee-isActive"
              name="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => update("isActive", checked === true)}
            />
            Aktif
          </Label>
        </>,
      )}
      {section(
        "Kart / kimlik",
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("cardNumber", "Kart numarası *")}
            {input("tcNo", "TC kimlik no")}
            {input("payrollCode", "Bordro kodu")}
            {select("accessRuleId", "Erişim kuralı ekle", accessRules)}
          </div>
          <p className="text-xs text-muted-foreground">
            Bu seçim mevcut erişimleri kaldırmaz. Üyelikleri kaldırmak için{" "}
            <a className="underline" href="/access-control">
              Geçiş Kontrol
            </a>{" "}
            sayfasını kullanın.
          </p>
        </>,
      )}
      {section("Fotoğraf", photo)}
      <details
        open={otherOpen}
        onToggle={(event) => setOtherOpen(event.currentTarget.open)}
        className="border-t pt-5"
      >
        <summary className="cursor-pointer text-base font-semibold">
          İsteğe bağlı diğer alanlar
        </summary>
        <div className="mt-4 space-y-4">
          {(["hourlyRate", "monthlySalary"] as const).map((key) => (
            <div key={key}>
              <Label htmlFor={`employee-${key}`}>
                {key === "hourlyRate"
                  ? "Saatlik ücret (TL)"
                  : "Aylık maaş (TL)"}
              </Label>
              <Input
                id={`employee-${key}`}
                name={key}
                type="number"
                min={0}
                step="0.01"
                value={formData[key] ?? ""}
                onChange={(e) =>
                  update(
                    key,
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                aria-invalid={!!errors[key]}
                aria-describedby={
                  errors[key] ? `employee-${key}-error` : undefined
                }
              />
              <FieldError id={`employee-${key}-error`} message={errors[key]} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            İki ücret de boşsa mesai TL hesabı yapılmaz.
          </p>
          <div>
            <Label htmlFor="employee-shift">Eski vardiya notu</Label>
            <Input
              id="employee-shift"
              name="shift"
              value={formData.shift ?? ""}
              onChange={(e) => update("shift", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Bu not vardiya ataması oluşturmaz.
            </p>
          </div>
          <div>
            <Label htmlFor="employee-notes">Notlar</Label>
            <Textarea
              id="employee-notes"
              name="notes"
              value={formData.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
