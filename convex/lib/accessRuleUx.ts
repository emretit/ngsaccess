const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function accessScheduleError(input: { days?: string[]; startTime?: string | null; endTime?: string | null }): string | null {
  if (!input.days?.length || input.days.some((day) => !DAYS.includes(day))) return "En az bir geçerli gün seçin.";
  const start = input.startTime || "";
  const end = input.endTime || "";
  if (Boolean(start) !== Boolean(end)) return "Başlangıç ve bitiş saatini birlikte girin veya tüm günü seçin.";
  if ((start && !HHMM.test(start)) || (end && !HHMM.test(end))) return "Saatleri HH:MM biçiminde girin.";
  if (start && end && start >= end) return "Bitiş saati başlangıçtan sonra olmalı. Geceyi aşan plan için ayrı kurallar oluşturun.";
  return null;
}

export function assertAccessSchedule(input: Parameters<typeof accessScheduleError>[0]): void {
  const error = accessScheduleError(input);
  if (error) throw new Error(error);
}

export function assertAccessScheduleUpdate(
  rule: Parameters<typeof accessScheduleError>[0],
  updates: Parameters<typeof accessScheduleError>[0],
): void {
  if (updates.days !== undefined || updates.startTime !== undefined || updates.endTime !== undefined) {
    assertAccessSchedule({ ...rule, ...updates });
  }
}
