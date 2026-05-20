import { OvertimeSettingsForm } from "./components/OvertimeSettingsForm";
import { HolidayCalendarManager } from "./components/HolidayCalendarManager";

export function WorkAndPayrollSettings() {
  return (
    <div className="space-y-6 p-6 bg-muted/50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mesai & Tatil</h1>
        <p className="text-muted-foreground mt-2">
          Mesai limitleri, fazla mesai oranları ve resmi tatil takvimi. Çalışma
          saatleri ve mola/tolerans değerleri her vardiyada ayrı yönetilir.
        </p>
      </div>
      <OvertimeSettingsForm />
      <HolidayCalendarManager />
    </div>
  );
}
