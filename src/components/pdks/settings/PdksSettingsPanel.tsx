import { Link } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SettingsFormState } from "@/components/settings/SettingsFormState";
import { useSettingsFormsGuard } from "@/components/settings/useSettingsFormsGuard";
import { OvertimeSettingsForm } from "@/components/settings/sections/components/OvertimeSettingsForm";
import { PdksRulesSettings } from "@/components/settings/sections/components/PdksRulesSettings";
import { HolidayCalendarManager } from "@/components/settings/sections/components/HolidayCalendarManager";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { WorkingDaysSettings } from "./WorkingDaysSettings";

/** PDKS Kayıtları › Ayarlar: çalışma günleri, mesai politikası, devam kuralları ve tatil takvimi. */
export function PdksSettingsPanel({ projectId }: { projectId: Id<"projects"> }) {
  const { reportForm, dialog } = useSettingsFormsGuard();
  return <div className="w-full min-w-0 max-w-[800px] space-y-8">
    <p className="text-sm text-muted-foreground">Çalışma saatleri, molalar ve vardiya atamaları <Link to="/shifts" className="underline">Vardiyalar</Link> sayfasında yönetilir. Tatil işlemleri mesai formundan ayrı kaydedilir.</p>
    <SettingsFormState.Provider value={reportForm}>
      <QuerySectionBoundary resetKey={projectId} title="PDKS ayarları yüklenemedi." description="Kayıtlar sekmesine geçebilir veya tekrar deneyebilirsiniz.">
        <WorkingDaysSettings projectId={projectId} /><OvertimeSettingsForm /><PdksRulesSettings /><HolidayCalendarManager />
      </QuerySectionBoundary>
    </SettingsFormState.Provider>
    {dialog}
  </div>;
}
