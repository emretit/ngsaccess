import { useId, useState } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormActions } from "@/components/shared/FormActions";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { Company, CompanyDetails } from "@/hooks/useOrgUnits";

const FIELDS = [
  ["phone", "Telefon", "tel"],
  ["email", "E-posta", "email"],
  ["taxNumber", "Vergi numarası", "text"],
] as const;

/** Şirket (şube) ekleme ve düzenleme: ad zorunlu, adres ve iletişim isteğe bağlı. */
export function CompanyDialog({ open, onOpenChange, company, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
  onSave: (details: CompanyDetails) => Promise<unknown>;
}) {
  const [values, setValues] = useState<Required<CompanyDetails>>({
    name: company?.name ?? "", address: company?.address ?? "", phone: company?.phone ?? "",
    email: company?.email ?? "", taxNumber: company?.taxNumber ?? "",
  });
  const [nameError, setNameError] = useState<string>();
  const id = useId();
  const { run, pending } = useAsyncAction(
    async (details: CompanyDetails) => { await onSave(details); },
    { success: company ? "Şirket güncellendi" : "Şirket eklendi", error: company ? "Şirket güncellenemedi" : "Şirket eklenemedi" },
  );
  const close = () => { if (!pending) onOpenChange(false); };
  return (
    <FormDialog
      open={open}
      onRequestClose={close}
      pending={pending}
      title={company ? "Şirketi düzenle" : "Yeni şirket"}
      description="Şirket ya da şube; kişiler ve departmanlar buna bağlanır."
      onSubmit={async (event) => {
        event.preventDefault();
        if (!values.name.trim()) { setNameError("Şirket adı zorunludur"); return; }
        setNameError(undefined);
        if (await run({ ...values, name: values.name.trim() })) onOpenChange(false);
      }}
      footer={<FormActions layout="dialog" className="pt-2" isLoading={pending} onClose={close} cancelLabel="İptal"
        submitLabel={company ? "Kaydet" : "Ekle"} busyLabel={company ? "Kaydediliyor…" : "Ekleniyor…"} />}
    >
      <div className="grid gap-4">
        <FormFieldWrapper htmlFor={`${id}-name`} label="Şirket adı *" error={nameError}>
          <Input id={`${id}-name`} value={values.name} disabled={pending} onChange={e => setValues({ ...values, name: e.target.value })} />
        </FormFieldWrapper>
        <FormFieldWrapper htmlFor={`${id}-address`} label="Adres">
          <Textarea id={`${id}-address`} value={values.address} disabled={pending} onChange={e => setValues({ ...values, address: e.target.value })} />
        </FormFieldWrapper>
        <div className="grid gap-4 min-[761px]:grid-cols-2">
          {FIELDS.map(([key, label, type]) => <FormFieldWrapper key={key} htmlFor={`${id}-${key}`} label={label}>
            <Input id={`${id}-${key}`} type={type} value={values[key]} disabled={pending} onChange={e => setValues({ ...values, [key]: e.target.value })} />
          </FormFieldWrapper>)}
        </div>
      </div>
    </FormDialog>
  );
}
