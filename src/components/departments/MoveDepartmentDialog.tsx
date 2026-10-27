import { useId, useState } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormActions } from "@/components/shared/FormActions";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { Company } from "@/hooks/useOrgUnits";
import type { Department } from "@/types/department";
import type { Id } from "../../../convex/_generated/dataModel";
import { NativeSelect } from "@/components/ui/native-select";

/** Üst seviye departmanı alt departmanları ve kişileriyle başka şirkete taşır. */
export function MoveDepartmentDialog({ department, companies, onOpenChange, onMove }: {
  department: Department | null;
  companies: Company[];
  onOpenChange: (open: boolean) => void;
  onMove: (departmentId: Id<"departments">, companyId: Id<"companies">) => Promise<unknown>;
}) {
  const [companyId, setCompanyId] = useState<string>(department?.companyId ?? "");
  const id = useId();
  const [error, setError] = useState<string>();
  const { run, pending } = useAsyncAction(
    async (target: Id<"companies">) => { if (department) await onMove(department._id, target); },
    { success: "Departman taşındı", error: "Departman taşınamadı" },
  );
  const close = () => { if (!pending) onOpenChange(false); };
  return (
    <FormDialog
      open={department !== null}
      onRequestClose={close}
      pending={pending}
      size="sm"
      title="Şirkete taşı"
      description={`${department?.name ?? ""} alt departmanları ve bağlı kişileriyle birlikte taşınır; kişilerin şirketi de değişir.`}
      onSubmit={async (event) => {
        event.preventDefault();
        const target = companies.find(company => company._id === companyId)?._id;
        setError(target ? undefined : "Şirket seçin");
        if (target && await run(target)) onOpenChange(false);
      }}
      footer={<FormActions layout="dialog" className="pt-2" isLoading={pending} onClose={close} cancelLabel="İptal" submitLabel="Taşı" busyLabel="Taşınıyor…" />}
    >
      <FormFieldWrapper htmlFor={id} label="Şirket *" error={error}>
        <NativeSelect id={id} value={companyId} disabled={pending} onChange={e => setCompanyId(e.target.value)}>
          <option value="">Şirket seçin</option>
          {companies.map(company => <option key={company._id} value={company._id}>{company.name}</option>)}
        </NativeSelect>
      </FormFieldWrapper>
    </FormDialog>
  );
}
