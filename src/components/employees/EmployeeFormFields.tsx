import { NativeSelect } from "@/components/ui/native-select";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import type { EmployeeFormData } from "./hooks/useEmployeeFormData";
import { usePermissions } from "@/hooks/usePermissions";
interface Option {
  id: string;
  name: string;
  /** Departman seçeneklerinde: departmanın şirketi. */
  companyId?: string;
}
interface Props {
  canViewPay?: boolean;
  isVisitor?: boolean;
  formData: EmployeeFormData;
  setFormData: (data: EmployeeFormData) => void;
  companies: Option[];
  departments: Option[];
  accessRules: Option[];
  positions: Option[];
  errors?: Partial<Record<string, string>>;
  photo?: ReactNode;
  autoFocusFirstName?: boolean;
  /** Kayıtlı kişiyi düzenlerken yardım metinleri yeni kayda göre değişir. */
  isEditing?: boolean;
  originalDepartmentId?: EmployeeFormData["departmentId"];
  memberships?: { _id: string; name: string; isActive?: boolean }[];
}
export function DepartmentShiftWarning({ isEditing, originalDepartmentId, departmentId }: {
  isEditing: boolean; originalDepartmentId: EmployeeFormData["departmentId"]; departmentId: EmployeeFormData["departmentId"];
}) {
  return isEditing && originalDepartmentId !== departmentId ? <p role="status" className="text-xs text-muted-foreground">Departman vardiya planı geçmiş günlere de uygulanır; kapanmış dönem için kişiye vardiya atayın.</p> : null;
}
export default function EmployeeFormFields({
  formData,
  canViewPay = false,
  isVisitor = false,
  setFormData,
  companies,
  departments,
  accessRules,
  positions,
  errors = {},
  photo,
  autoFocusFirstName = false,
  isEditing = false,
  originalDepartmentId = null,
  memberships,
}: Props) {
  const { can } = usePermissions();
  const canManageAccessRules = can("accessRules.manage");
  const [otherOpen, setOtherOpen] = useState(false);
  useEffect(() => {
    if (errors.hourlyRate || errors.monthlySalary) setOtherOpen(true);
  }, [errors.hourlyRate, errors.monthlySalary]);
  const filledOther = [
    canViewPay && formData.hourlyRate != null,
    canViewPay && formData.monthlySalary != null,
    !!formData.shift?.trim(),
    !!formData.notes?.trim(),
  ].filter(Boolean).length;
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
      | "payrollCode"
      | "accessStartsAt",
    label: string,
    type = "text",
    hint?: string,
  ) => {
    return (
    <FormFieldWrapper htmlFor={`employee-${key}`} label={label} error={errors[key]} hint={hint}>
      {type === "date" ? (
        <DateInput
          className="max-sm:min-h-11"
          id={`employee-${key}`}
          value={formData[key] ?? ""}
          onChange={(value) => update(key, value)}
        />
      ) : (
      <Input
        className="max-sm:min-h-11"
        id={`employee-${key}`}
        name={key}
        autoFocus={key === "firstName" && autoFocusFirstName}
        type={type}
        required={["firstName", "lastName", "email", "cardNumber"].includes(
          key,
        )}
        value={formData[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
        maxLength={key === "tcNo" ? 11 : undefined}
        inputMode={key === "tcNo" ? "numeric" : undefined}
      />
      )}
    </FormFieldWrapper>
    );
  };
  // Şirket seçiliyse yalnız o şirketin ve şirketsiz departmanlar listelenir.
  const companyDepartments = formData.companyId
    ? departments.filter((department) => !department.companyId || department.companyId === formData.companyId)
    : departments;
  const changeSelect = (key: "companyId" | "departmentId" | "positionId" | "accessRuleId", raw: string) => {
    const value = raw || null;
    if (key === "departmentId") {
      // Şirkete bağlı departman kişinin şirketini de belirler.
      const companyId = departments.find((department) => department.id === value)?.companyId;
      setFormData({ ...formData, departmentId: value as EmployeeFormData["departmentId"], ...(companyId ? { companyId: companyId as EmployeeFormData["companyId"] } : {}) });
      return;
    }
    if (key === "companyId") {
      const departmentCompany = departments.find((department) => department.id === formData.departmentId)?.companyId;
      const keepDepartment = !departmentCompany || departmentCompany === value;
      setFormData({ ...formData, companyId: value as EmployeeFormData["companyId"], ...(keepDepartment ? {} : { departmentId: null }) });
      return;
    }
    update(key, value as EmployeeFormData[typeof key]);
  };
  const select = (
    key: "companyId" | "departmentId" | "positionId" | "accessRuleId",
    label: string,
    options: Option[],
  ) => (
    <div>
      <Label htmlFor={`employee-${key}`}>{label}</Label>
      <NativeSelect
        id={`employee-${key}`}
        name={key}
        className="mt-1 max-sm:min-h-11 w-full min-w-0"
        disabled={key === "accessRuleId" && !canManageAccessRules}
        aria-describedby={[
          options.length === 0 && `employee-${key}-empty`,
          key === "accessRuleId" && !canManageAccessRules && "employee-accessRuleId-permission",
        ].filter(Boolean).join(" ") || undefined}
        value={formData[key] ?? ""}
        onChange={(e) => changeSelect(key, e.target.value)}
      >
        <option value="">
          {key === "accessRuleId" ? (isEditing ? "Ek kural seçilmedi" : "Kural eklenmesin") : "Atanmamış"}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </NativeSelect>
      {key === "accessRuleId" && !canManageAccessRules && (
        <p id="employee-accessRuleId-permission" className="mt-1 text-xs text-muted-foreground">
          Kural eklemek için erişim kurallarını yönetme yetkisi gerekir.
        </p>
      )}
      {options.length === 0 && (
        <p id={`employee-${key}-empty`} className="mt-1 text-xs text-muted-foreground">
          {{
            companyId: "Henüz şirket tanımlı değil.",
            departmentId: "Henüz departman tanımlı değil.",
            positionId: "Henüz pozisyon tanımlı değil.",
            accessRuleId: "Etkin erişim kuralı yok.",
          }[key]}
        </p>
      )}
    </div>
  );
  const section = (title: string, children: ReactNode) => (
    <fieldset className="min-w-0 space-y-3 border-t">
      <legend className="pr-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
  return (
    <div className="min-w-0 space-y-4">
      {section(
        "Kimlik ve iletişim",
        <>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {input("firstName", "Ad *")}
            {input("lastName", "Soyad *")}
          </div>
          {input(
            "email",
            "E-posta *",
            "email",
            isEditing
              ? "Kaydetmek bağlantı göndermez. Gerekirse: satır menüsü → Mobil giriş bağlantısı gönder."
              : "Mobil giriş kurulum bağlantısı bu adrese gönderilir.",
          )}
        </>,
      )}
      {section(
        "Organizasyon",
        <>
          {isEditing && (
            <div>
              <Label htmlFor="employee-projectId">Proje</Label>
              <Input id="employee-projectId" value="Mevcut proje" disabled aria-describedby="employee-projectId-hint" />
              <p id="employee-projectId-hint" className="mt-1 text-xs text-muted-foreground">
                Kişi başka projeye taşınamaz. Yeni projede yeni kayıt açın, eski kaydı işten çıkarın.
              </p>
            </div>
          )}
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
            {select("companyId", "Şirket", companies)}
            {select("departmentId", "Departman", companyDepartments)}
            {select("positionId", "Pozisyon", positions)}
          </div>
          <DepartmentShiftWarning isEditing={isEditing} originalDepartmentId={originalDepartmentId} departmentId={formData.departmentId} />
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
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
            {input("cardNumber", "Kart numarası *", "text", "Baştaki sıfırlar dahil")}
            {input("tcNo", "TC kimlik no", "text", "11 hane, 0 ile başlamaz")}
            {input("payrollCode", "Bordro kodu")}
          </div>
        </>,
      )}
      {section(
        "Erişim",
        <>
          {isEditing && (memberships === undefined ? (
            <SectionSkeleton label="Erişim üyelikleri yükleniyor" />
          ) : memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu kişiye erişim kuralı atanmamış.</p>
          ) : (
            <ul className="divide-y">
              {memberships.map(rule => (
                <li key={rule._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{rule.name}</span>
                  <StatusBadge tone={rule.isActive === false ? "neutral" : "success"}>
                    {rule.isActive === false ? "Pasif" : "Aktif"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          ))}
          {!isVisitor && input("accessStartsAt", "Erişim başlangıcı", "date", "Bu tarihten önce kart, QR ve mobil erişim reddedilir.")}
          {select("accessRuleId", isEditing ? "Ek erişim kuralı" : "Erişim kuralı ekle", accessRules)}
          <p className="text-xs text-muted-foreground">
            {isEditing ? (
              <>
                Bu seçim mevcut erişimleri kaldırmaz. Üyelikleri kaldırmak için{" "}
                <Link className="inline-flex items-center max-sm:min-h-11 underline" to="/access-control">
                  Geçiş Kontrol
                </Link>{" "}
                sayfasını kullanın.
              </>
            ) : (
              "İsteğe bağlı; kişi kayıtla birlikte bu kurala eklenir."
            )}
          </p>
        </>,
      )}
      {section("Fotoğraf", photo)}
      <details
        open={otherOpen}
        onToggle={(event) => setOtherOpen(event.currentTarget.open)}
        className="border-t pt-3"
      >
        <summary className="max-sm:min-h-11 cursor-pointer py-2 text-sm font-semibold">
          {canViewPay ? "Ücret ve diğer bilgiler" : "Diğer bilgiler"}
          {filledOther > 0 && (
            <span className="ml-1 font-normal text-muted-foreground">
              ({filledOther} dolu)
            </span>
          )}
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {canViewPay && (["hourlyRate", "monthlySalary"] as const).map((key) => (
              <FormFieldWrapper key={key} htmlFor={`employee-${key}`} label={key === "hourlyRate" ? "Saatlik ücret (TL)" : "Aylık maaş (TL)"} error={errors[key]}>
                <Input
                  className="max-sm:min-h-11"
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
                  aria-describedby="employee-pay-hint"
                />
              </FormFieldWrapper>
            ))}
          </div>
          {canViewPay && <p id="employee-pay-hint" className="-mt-2 text-xs text-muted-foreground">
            İki ücret de boşsa mesai TL hesabı yapılmaz.
          </p>}
          <div>
            <Label htmlFor="employee-shift">Eski vardiya notu</Label>
            <Input
              className="max-sm:min-h-11"
              id="employee-shift"
              name="shift"
              value={formData.shift ?? ""}
              onChange={(e) => update("shift", e.target.value)}
              aria-describedby="employee-shift-hint"
            />
            <p id="employee-shift-hint" className="text-xs text-muted-foreground">
              Bu not vardiya ataması oluşturmaz.
            </p>
          </div>
          <div>
            <Label htmlFor="employee-notes">Notlar</Label>
            <Textarea
              className="max-sm:min-h-11"
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
