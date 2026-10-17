import { useEffect, useState } from "react";
import type { VisitorDetail } from "@/types/visitor";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import VisitorFormFields from "./VisitorFormFields";
import VisitorZoneDialog from "./VisitorZoneDialog";
import { useVisitorFormData } from "./hooks/useVisitorFormData";
import { useVisitorFormSubmit } from "./hooks/useVisitorFormSubmit";
import { visitorFormSchema } from "./hooks/useVisitorFormSchema";
import { isoToLocalInput } from "./visitorTime";

export default function VisitorForm({ visitor, onClose, onSave, onStateChange }: {
  visitor?: VisitorDetail | null; onClose: () => void; onSave: (payload?: unknown) => void;
  onStateChange: (dirty: boolean, pending: boolean) => void;
}) {
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [failed, setFailed] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const { formData, setFormData, presetRules, hostEmployees, optionsLoading, isDirty } = useVisitorFormData(visitor);
  const { isLoading, handleSubmit } = useVisitorFormSubmit(visitor, onSave);
  useEffect(() => { onStateChange(isDirty, isLoading); }, [isDirty, isLoading, onStateChange]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = visitorFormSchema.safeParse({ ...formData, isEditing: !!visitor, originalExpiry: visitor ? isoToLocalInput(visitor.visitEnd ?? "") : undefined, wasActive: visitor?.isActive });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      const ids: Record<string, string> = { firstName: "v_first_name", lastName: "v_last_name", cardNumber: "v_card", presetRuleId: "v_zone", accessExpiresAt: "v_expires" };
      requestAnimationFrame(() => document.getElementById(ids[String(result.error.issues[0]?.path[0])])?.focus());
      return;
    }
    setFieldErrors({}); setFailed(false);
    if (!await handleSubmit(formData)) setFailed(true);
  };
  return <>
    <form onSubmit={onSubmit} className="min-w-0" noValidate>
      <fieldset disabled={isLoading} className="min-w-0 space-y-5 p-5">
        {optionsLoading ? <SectionSkeleton rows={5} label="Form bilgileri yükleniyor" /> : <VisitorFormFields formData={formData} setFormData={setFormData} presetRules={presetRules} hostEmployees={hostEmployees} isEditing={!!visitor} kvkkConsentAt={visitor?.kvkkConsent?.grantedAt} errors={fieldErrors} onNewZone={() => setZoneOpen(true)} />}
        {failed && <p role="alert" className="text-sm text-destructive">Ziyaretçi kaydedilemedi. Girişleriniz korundu; bilgileri kontrol edip tekrar deneyin.</p>}
      </fieldset>
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-surface p-4">
        <Button type="button" variant="outline" disabled={isLoading} onClick={onClose}>Vazgeç</Button>
        <Button type="submit" disabled={isLoading || optionsLoading}>{isLoading ? "Kaydediliyor…" : visitor ? "Değişiklikleri kaydet" : "Ziyaretçiyi kaydet"}</Button>
      </div>
    </form>
    {zoneOpen && <QuerySectionBoundary title="Erişim bölgeleri yüklenemedi"><VisitorZoneDialog isOpen onClose={() => setZoneOpen(false)} onCreated={id => { setFormData({ ...formData, presetRuleId: id }); setZoneOpen(false); }} /></QuerySectionBoundary>}
  </>;
}
