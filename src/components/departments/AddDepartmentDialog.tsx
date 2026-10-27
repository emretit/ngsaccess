import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
}

export function AddDepartmentDialog({
  isOpen,
  onOpenChange,
  onAdd,
  successMessage = "Departman eklendi",
  title = "Yeni Departman Ekle",
  description = "Departmanın adını girin",
}: AddDepartmentDialogProps) {
  const [departmentName, setDepartmentName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const inputId = useId();
  const { run, pending } = useAsyncAction(
    async (name: string) => {
      if ((await onAdd(name)) === false)
        throw new Error("Departman eklenemedi");
    },
    { success: successMessage, error: "Departman eklenemedi" },
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
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent
        className="sm:max-w-[440px]"
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!departmentName.trim()) {
              setNameError("Departman adı zorunludur");
              return;
            }
            setNameError(undefined);
            if (await run(departmentName.trim())) {
              setDepartmentName("");
              onOpenChange(false);
            }
          }}
          className="space-y-4"
        >
          <FormFieldWrapper
            htmlFor={inputId}
            label="Departman adı"
            error={nameError}
          >
            <Input
              id={inputId}
              value={departmentName}
              disabled={pending}
              onChange={(event) => setDepartmentName(event.target.value)}
            />
          </FormFieldWrapper>
          <FormActions layout="dialog" className="pt-2" isLoading={pending} onClose={() => close(false)} cancelLabel="İptal" submitLabel="Ekle" busyLabel="Ekleniyor…" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
