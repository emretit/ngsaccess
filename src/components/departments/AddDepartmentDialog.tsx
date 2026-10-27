import { FormDialog } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import { FormActions } from "@/components/shared/FormActions";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useId, useState } from "react";

interface AddDepartmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => Promise<boolean | void>;
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
}: AddDepartmentDialogProps) {
  const [departmentName, setDepartmentName] = useState(initialName);
  const [nameError, setNameError] = useState<string>();
  const inputId = useId();
  const { run, pending } = useAsyncAction(
    async (name: string) => {
      if ((await onAdd(name)) === false)
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
        if (!departmentName.trim()) {
          setNameError(`${fieldLabel} zorunludur`);
          return;
        }
        setNameError(undefined);
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
