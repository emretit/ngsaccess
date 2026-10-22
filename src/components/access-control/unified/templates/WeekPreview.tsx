import {
  DAY_NAMES,
  WEEKDAYS,
  formatSchedule,
  type WeekSchedule,
} from "./schedule";
export function WeekPreview({ week }: { week: WeekSchedule }) {
  const minute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  return (
    <div className="space-y-2 min-w-0" aria-label="Haftalık saat önizlemesi">
      <p className="text-sm break-words">{formatSchedule(week)}</p>
      <p className="text-xs text-muted-foreground">
        Türkiye saati (Europe/Istanbul) · 00:00 — 24:00
      </p>
      {WEEKDAYS.map((day, i) => (
        <div key={day} className="flex gap-2 items-center text-xs">
          <span className="w-20 shrink-0">{DAY_NAMES[i]}</span>
          <div
            className="h-4 flex-1 relative rounded bg-muted overflow-hidden"
            aria-label={`${DAY_NAMES[i]}: ${week[day].map((r) => `${r.start}–${r.end}`).join(", ") || "Erişim yok"}`}
          >
            {week[day].map((r, index) => (
              <span
                key={index}
                className="absolute h-full bg-primary"
                style={{
                  left: `${minute(r.start) / 14.4}%`,
                  width: `${(minute(r.end) - minute(r.start)) / 14.4}%`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
