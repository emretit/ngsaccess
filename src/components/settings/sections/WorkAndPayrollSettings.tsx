import { WorkScheduleForm } from "./components/WorkScheduleForm";
import { OvertimeRatesForm } from "./components/OvertimeRatesForm";
import { HolidayCalendarManager } from "./components/HolidayCalendarManager";

export function WorkAndPayrollSettings() {
  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mesai & Tatil</h1>
        <p className="text-gray-600 mt-2">
          Çalışma saatleri, fazla mesai oranları ve resmi tatil takvimi
        </p>
      </div>
      <WorkScheduleForm />
      <OvertimeRatesForm />
      <HolidayCalendarManager />
    </div>
  );
}
