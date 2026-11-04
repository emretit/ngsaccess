import { Link } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SettingsFormState } from "@/components/settings/SettingsFormState";
import { useSettingsFormsGuard } from "@/components/settings/useSettingsFormsGuard";
import { OvertimeSettingsForm } from "@/components/settings/sections/components/OvertimeSettingsForm";
import { PdksRulesSettings } from "@/components/settings/sections/components/PdksRulesSettings";
import { HolidayCalendarManager } from "@/components/settings/sections/components/HolidayCalendarManager";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { CheckpointWarnings } from "./CheckpointWarnings";

const CARD = "min-w-0 rounded-lg border bg-surface p-3 min-[761px]:p-4";

/** PDKS › Ayarlar: mesai politikası, devam kuralları ve tatil takvimi. */
export function PdksSettingsPanel({ projectId }: { projectId: Id<"projects"> }) {
  const { reportForm, dialog } = useSettingsFormsGuard();
  return <div className="w-full min-w-0 space-y-4">
    <p className="text-sm text-muted-foreground">Hafta tatili günleri vardiya planında seçilir. <Link to="/pdks-records?plan=1" className="underline">Vardiya planı</Link></p>
    <SettingsFormState.Provider value={reportForm}>
      <QuerySectionBoundary resetKey={projectId} title="PDKS ayarları yüklenemedi." description="Kayıtlar sekmesine geçebilir veya tekrar deneyebilirsiniz."
        className="grid min-w-0 items-start gap-4 min-[1200px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={`${CARD} min-[1200px]:col-span-2`}><OvertimeSettingsForm /></div>
        <div className="min-w-0 space-y-4"><CheckpointWarnings projectId={projectId} /><div className={CARD}><PdksRulesSettings /></div></div>
        <div className="min-w-0 space-y-4"><div className={CARD}><HolidayCalendarManager /></div></div>
      </QuerySectionBoundary>
    </SettingsFormState.Provider>
    {dialog}
  </div>;
}
