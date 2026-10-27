import { useRef, useState } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormActions } from "@/components/shared/FormActions";
import { Input } from "@/components/ui/input";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Textarea } from "@/components/ui/textarea";

interface AddZoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddZoneDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddZoneDialogProps) {
  const { projectId } = useActiveProject();
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const nameInput = useRef<HTMLInputElement>(null);
  const guard = useUnsavedChangesGuard(
    open && (name !== "" || description !== ""),
  );
  const create = useMutation(api.zones.create);
  const { run, pending } = useAsyncAction(
    async () => {
      await create({
        name: name.trim(),
        projectId,
        description: description.trim() || undefined,
      });
      notify.success("Bölge eklendi");
      setName("");
      onSuccess();
      setDescription("");
      onOpenChange(false);
    },
    { error: "Bölge eklenemedi" },
  );
  const close = () => {
    if (!pending)
      guard.requestClose(() => {
        setName("");
        setError(undefined);
        setDescription("");
        onOpenChange(false);
      });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Bölge adı gereklidir.");
      nameInput.current?.focus();
      return;
    }
    setError(undefined);
    void run();
  };
  return (
    <>
      <FormDialog
        open={open}
        onRequestClose={close}
        pending={pending}
        title="Bölge ekle"
        size="sm"
        onSubmit={submit}
        footer={
          <FormActions
            layout="dialog"
            className="pt-2"
            isLoading={pending}
            onClose={close}
            cancelLabel="İptal"
            submitLabel="Ekle"
            busyLabel="Ekleniyor…"
          />
        }
      >
        <fieldset disabled={pending} className="space-y-4">
          <FormFieldWrapper
            htmlFor="add-zone-name"
            label="Bölge adı"
            error={error}
          >
            <Input
              ref={nameInput}
              id="add-zone-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
            />
          </FormFieldWrapper>
          <FormFieldWrapper htmlFor="add-zone-description" label="Açıklama">
            <Textarea
              id="add-zone-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormFieldWrapper>
        </fieldset>
      </FormDialog>
      {guard.dialog}
    </>
  );
}
