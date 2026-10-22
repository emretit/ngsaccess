import { PdksRulesSettings } from "./components/PdksRulesSettings";
import { Link } from "react-router-dom";
import { OvertimeSettingsForm } from "./components/OvertimeSettingsForm";
import { HolidayCalendarManager } from "./components/HolidayCalendarManager";

export function WorkAndPayrollSettings() {
  return <div className="min-w-0 space-y-8">
    <p className="text-sm text-muted-foreground">Çalışma saatleri, molalar ve vardiya atamaları <Link to="/shifts" className="underline">Vardiyalar</Link> sayfasında yönetilir. Tatil işlemleri mesai formundan ayrı kaydedilir.</p>
    <OvertimeSettingsForm /><PdksRulesSettings /><HolidayCalendarManager />
  </div>;
}
