import type { Id } from "../../../../../convex/_generated/dataModel";
import type {
  WeekSchedule,
  Weekday,
} from "../../../../../convex/lib/accessSchedule";
export function addInterval(week: WeekSchedule, day: Weekday): WeekSchedule {
  if (week[day].length >= 8) return week;
  return { ...week, [day]: [...week[day], { start: "08:00", end: "17:00" }] };
}
export function removeInterval(
  week: WeekSchedule,
  day: Weekday,
  index: number,
): WeekSchedule {
  return { ...week, [day]: week[day].filter((_, n) => n !== index) };
}
export type ScheduleMode = "custom" | "template";
export function changeScheduleMode<T extends { scheduleMode?: ScheduleMode }>(
  form: T,
  scheduleMode: ScheduleMode,
): T {
  return { ...form, scheduleMode };
}
export function scheduleBinding(
  mode: ScheduleMode,
  id: string,
  previousId?: string,
): Id<"accessScheduleTemplates"> | null | undefined {
  return mode === "template"
    ? id === previousId
      ? undefined
      : (id as Id<"accessScheduleTemplates">)
    : previousId
      ? null
      : undefined;
}
export function initialScheduleMode(templateId?: string): ScheduleMode {
  return templateId ? "template" : "custom";
}
export function saveDecision(input: {
  valid: boolean;
  pending: boolean;
  name: string;
  ruleCount: number;
  confirmed: boolean;
  overLimit: number;
}): "disabled" | "preview" | "save" {
  if (
    !input.valid ||
    input.pending ||
    !input.name.trim() ||
    input.overLimit > 0
  )
    return "disabled";
  return input.ruleCount > 0 && !input.confirmed ? "preview" : "save";
}
export function visibleTemplates<T extends { isArchived?: boolean }>(
  rows: T[],
  includeArchived: boolean,
): T[] {
  return rows.filter((t) => includeArchived || !t.isArchived);
}

export function requestTemplateEdit(
  requestClose: (close: () => void) => void,
  onClose: () => void,
  navigate: () => void,
): void {
  requestClose(() => {
    onClose();
    navigate();
  });
}
