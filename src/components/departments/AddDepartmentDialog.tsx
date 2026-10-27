import { FormDialog } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import { FormActions } from "@/components/shared/FormActions";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useId, useState } from "react";

interface AddDepartmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, companyId: string | null) => Promise<boolean | void>;
  /** Verilirse şirket seçimi zorunlu alan olarak gösterilir. */
  companies?: ReadonlyArray<{ _id: string; name: string }>;
  initialCompanyId?: string;
  title?: string;
  successMessage?: string;
  description?: string;
  /** Aynı ad penceresi pozisyon ve yeniden adlandırma için de kullanılır. */
  fieldLabel?: string;
  errorMessage?: string;
  submitLabel?: string;
  busyLabel?: string;
  initialName?: string;
}

export function AddDepartmentDialog({
  isOpen,
  onOpenChange,
  onAdd,
  successMessage = "Departman eklendi",
  title = "Yeni Departman Ekle",
  description = "Departmanın adını girin",
  fieldLabel = "Departman adı",
  errorMessage = "Departman eklenemedi",
  submitLabel = "Ekle",
  busyLabel = "Ekleniyor…",
  initialName = "",
  companies,
  initialCompanyId = "",
}: AddDepartmentDialogProps) {
  const [departmentName, setDepartmentName] = useState(initialName);
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [nameError, setNameError] = useState<string>();
  const [companyError, setCompanyError] = useState<string>();
  const inputId = useId();
  const { run, pending } = useAsyncAction(
    async (name: string) => {
      if ((await onAdd(name, companies ? companyId : null)) === false)
        throw new Error(errorMessage);
    },
    { success: successMessage, error: errorMessage },
  );
  const close = (open: boolean) => {
    if (pending) return;
    if (!open) {
      setDepartmentName("");
      setNameError(undefined);
    }
    onOpenChange(open);
  };
  return (
    <FormDialog
      open={isOpen}
      onRequestClose={() => close(false)}
      pending={pending}
      title={title}
      size="sm"
      description={description}
      onSubmit={async (event) => {
        event.preventDefault();
        const missingName = !departmentName.trim();
        const missingCompany = Boolean(companies) && !companyId;
        setNameError(missingName ? `${fieldLabel} zorunludur` : undefined);
        setCompanyError(missingCompany ? "Şirket seçin" : undefined);
        if (missingName || missingCompany) return;
        if (await run(departmentName.trim())) {
          setDepartmentName("");
          onOpenChange(false);
        }
      }}
      footer={
        <FormActions
          layout="dialog"
          className="pt-2"
          isLoading={pending}
          onClose={() => close(false)}
          cancelLabel="İptal"
          submitLabel={submitLabel}
          busyLabel={busyLabel}
        />
      }
    >
      {companies && (
        <FormFieldWrapper htmlFor={`${inputId}-company`} label="Şirket *" error={companyError}>
          <select
            id={`${inputId}-company`}
            value={companyId}
            disabled={pending}
            onChange={(event) => setCompanyId(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Şirket seçin</option>
            {companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
          </select>
        </FormFieldWrapper>
      )}
      <FormFieldWrapper
        htmlFor={inputId}
        label={fieldLabel}
        error={nameError}
      >
        <Input
          id={inputId}
          value={departmentName}
          disabled={pending}
          onChange={(event) => setDepartmentName(event.target.value)}
        />
      </FormFieldWrapper>
    </FormDialog>
  );
}
