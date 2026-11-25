import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { VisitorPassCard } from "./VisitorPassCard";
import { FormFeedback } from "@/components/shared/FormFeedback";
import { useEffect, useState } from "react";
import type { VisitorDetail } from "@/types/visitor";
import { FormActions } from "@/components/shared/FormActions";
import VisitorFormFields from "./VisitorFormFields";
import { useVisitorFormData } from "./hooks/useVisitorFormData";
import { useVisitorFormSubmit } from "./hooks/useVisitorFormSubmit";
import { visitorFormSchema } from "./hooks/useVisitorFormSchema";
import { isoToLocalInput, localInputToIso } from "./visitorTime";
import { canAssignVisitorPreset } from "./lib/preRegistration";
import { isVirtualReader } from "../../../convex/lib/virtualReader";

export default function VisitorForm({ visitor, onClose, onSave, onStateChange }: {
  visitor?: VisitorDetail | null; onClose: () => void; onSave: (payload?: unknown) => void;
  onStateChange: (dirty: boolean, pending: boolean) => void;
}) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [failed, setFailed] = useState(false);
  const { formData, setFormData, hostEmployees, hostSearch, setHostSearch, hostsLoading, isDirty } = useVisitorFormData(visitor);
  const doors = useQuery(api.doors.list, formData.projectId ? { projectId: formData.projectId } : "skip");
  const { isLoading, handleSubmit, issued, savedId } = useVisitorFormSubmit(visitor, onSave);
  const needsPassReader = !visitor && formData.credential === "pass";
  const devices = useQuery(api.devices.list, needsPassReader && formData.projectId ? { projectId: formData.projectId } : "skip");
  const passReaderUnavailable = needsPassReader && !savedId && !devices?.some(device => isVirtualReader(device) && device.isActive !== false && (!device.virtualReaderDoorId || formData.selected_doors.includes(device.virtualReaderDoorId)));
  const isPreRegistration = canAssignVisitorPreset(visitor);
  useEffect(() => { onStateChange(issued ? false : isDirty, isLoading); }, [isDirty, isLoading, onStateChange, issued]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passReaderUnavailable) return;
    const result = visitorFormSchema.safeParse({ ...formData, isEditing: !!visitor, isPreRegistration, originalExpiry: visitor ? isoToLocalInput(visitor.visitEnd ?? "") : undefined, wasActive: visitor?.isActive });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      const ids: Record<string, string> = { maxUses: "v_limit", email: "v_email", firstName: "v_first_name", lastName: "v_last_name", cardNumber: "v_card", doors: "v_doors", accessExpiresAt: "v_expires" };
      const firstError = ["maxUses", "email", "doors", "accessExpiresAt", "cardNumber", "firstName", "lastName"].find(key => errors[key]);
      if (firstError) requestAnimationFrame(() => document.getElementById(ids[firstError])?.focus());
      return;
    }
    setFieldErrors({}); setFailed(false);
    if (!await handleSubmit(formData)) setFailed(true);
  };
  if (issued) return <VisitorPassCard visitorId={issued.visitorId} secret={issued.secret} name={`${formData.firstName} ${formData.lastName}`} expiresAt={formData.accessExpiresAt ? localInputToIso(formData.accessExpiresAt) : null} doors={doors?.filter(door => formData.selected_doors.includes(door._id)).map(door => door.name).join(", ")} onClose={() => onSave({ _id: issued.visitorId })} />;
  return (
    <form onSubmit={onSubmit} className="min-w-0" noValidate>
      <fieldset disabled={isLoading || !!savedId} className="min-w-0 space-y-5 p-5">
        <VisitorFormFields formData={formData} setFormData={setFormData} assignedDoors={visitor?.presetRuleName} hostEmployees={hostEmployees} hostSearch={hostSearch} onHostSearchChange={setHostSearch} hostsLoading={hostsLoading} isCurrentlyActive={visitor?.isActive === true} isEditing={!!visitor} isPreRegistration={isPreRegistration} kvkkConsentAt={visitor?.kvkkConsent?.grantedAt} errors={fieldErrors} />
        {passReaderUnavailable && <FormFeedback tone="error">{devices === undefined ? "Sanal okuyucular kontrol ediliyor…" : "Seçilen kapılar için aktif sanal okuyucu bulunmuyor. Cihazlar sayfasından sanal okuyucu ekleyin veya kapı bağlantısını kontrol edin."}</FormFeedback>}
        {failed && <FormFeedback tone="error">{savedId ? "Ziyaretçi kaydedildi; geçiş kodu oluşturulamadı. Tekrar kaydet diyerek kod oluşturmayı deneyin; yeni ziyaretçi kaydı açılmaz." : "Ziyaretçi kaydedilemedi. Girişleriniz korundu; bilgileri kontrol edip tekrar deneyin."}</FormFeedback>}
      </fieldset>
      <FormActions isLoading={isLoading} submitDisabled={passReaderUnavailable} onClose={onClose} busyLabel="Kaydediliyor…" submitLabel={isPreRegistration && formData.isActive ? "Erişimi etkinleştir" : visitor ? "Değişiklikleri kaydet" : "Ziyaretçiyi kaydet"} />
    </form>
  );
}
