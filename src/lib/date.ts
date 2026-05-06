/**
 * Returns YYYY-MM-DD in the local timezone.
 * Use instead of `date.toISOString().split("T")[0]` which uses UTC and shifts the date
 * for users east/west of UTC near midnight.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
