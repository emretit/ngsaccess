import { todayInTurkey } from "@/lib/date";

export function pdksToday(): Date {
  return new Date(`${todayInTurkey()}T12:00:00`);
}
