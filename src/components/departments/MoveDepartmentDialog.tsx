import { useId, useState } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormActions } from "@/components/shared/FormActions";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { Company } from "@/hooks/useOrgUnits";
import type { Department } from "@/types/department";
import type { Id } from "../../../convex/_generated/dataModel";

/** Üst seviye departmanı alt departmanları ve kişileriyle başka şirkete taşır. */
export function MoveDepartmentDialog({ department, companies, onOpenChange, onMove }: {
  department: Department | null;
  companies: Company[];
  onOpenChange: (open: boolean) => void;
  onMove: (departmentId: Id<"departments">, companyId: Id<"companies"> | null) => Promise<unknown>;
}) {
  const [companyId, setCompanyId] = useState<string>(department?.companyId ?? "");
  const id = useId();
  const { run, pending } = useAsyncAction(
    async (target: Id<"companies"> | null) => { if (department) await onMove(department._id, target); },
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
        const target = companies.find(company => company._id === companyId)?._id ?? null;
        if (await run(target)) onOpenChange(false);
      }}
      footer={<FormActions layout="dialog" className="pt-2" isLoading={pending} onClose={close} cancelLabel="İptal" submitLabel="Taşı" busyLabel="Taşınıyor…" />}
    >
      <FormFieldWrapper htmlFor={id} label="Şirket">
        <select id={id} value={companyId} disabled={pending} onChange={e => setCompanyId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Şirketsiz</option>
          {companies.map(company => <option key={company._id} value={company._id}>{company.name}</option>)}
        </select>
      </FormFieldWrapper>
    </FormDialog>
  );
}
