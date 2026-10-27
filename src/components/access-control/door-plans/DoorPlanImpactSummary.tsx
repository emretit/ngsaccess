import {
  DOOR_STATUS_DAYS,
  type DoorStatusPlan,
  type VerifyPlan,
} from "../../../../convex/lib/doorStatusPlan";

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MODE_TEXT = {
  remainOpen: "sürekli açık kalacak",
  remainClosed: "sürekli kilitli kalacak",
  normal: "normal çalışır",
};
const VERIFY_TEXT: Record<string, string> = {
  card: "Kart", face: "Yüz", fp: "Parmak izi", pw: "Şifre", cardOrFace: "Kart veya yüz",
  cardAndPw: "Kart ve şifre", faceAndCard: "Yüz ve kart", cardAndFace: "Yüz ve kart",
  faceAndPw: "Yüz ve şifre",
};
const clock = (time: string) => time.endsWith(":00") && time.length === 8 ? time.slice(0, 5) : time;
const hours = (segment: { beginTime: string; endTime: string }) => `${clock(segment.beginTime)}–${clock(segment.endTime)}`;

function weeklySummary<T extends { beginTime: string; endTime: string }>(
  week: { day: typeof DOOR_STATUS_DAYS[number]; segments: T[] }[],
  describe: (segment: T) => string,
) {
  const groups: { start: number; end: number; text: string }[] = [];
  DOOR_STATUS_DAYS.forEach((day, index) => {
    const segments = week.find((entry) => entry.day === day)?.segments ?? [];
    const text = segments.map(describe).join(", ");
    if (!text) return;
    const previous = groups[groups.length - 1];
    if (previous && previous.end === index - 1 && previous.text === text) previous.end = index;
    else groups.push({ start: index, end: index, text });
  });
  const text = groups.map((group) => `${DAYS[group.start]}${group.end !== group.start ? `–${DAYS[group.end]}` : ""} ${group.text}`).join("; ");
  return text.length > 180
    ? { text: `Haftalık · ${week.reduce((count, day) => count + day.segments.length, 0)} aralık`, truncated: true }
    : { text: text || "Zaman aralığı yok", truncated: false };
}

export function DoorPlanImpactSummary({ doorName, statusPlan, template, verifyPlan, holiday }: {
  doorName: string;
  statusPlan?: DoorStatusPlan;
  template: boolean;
  verifyPlan?: VerifyPlan;
  holiday?: { enabled: boolean; year: number; mode: DoorStatusPlan["mode"] };
}) {
  const statusOpen = statusPlan?.enabled && (template
    ? statusPlan.mode === "remainOpen"
    : statusPlan.weekly
      ? statusPlan.weekly.some((day) => day.segments.some((segment) => segment.mode === "remainOpen"))
      : statusPlan.mode === "remainOpen");
  const statusWeekly = statusPlan?.enabled && !template && statusPlan.weekly
    ? weeklySummary(statusPlan.weekly, (segment) => `${hours(segment)} ${MODE_TEXT[segment.mode]}`)
    : undefined;
  const statusText = statusPlan && (!statusPlan.enabled ? "Etkin değil; kapı normal çalışır" : template
    ? `Seçilen zaman şablonundaki saatlerde ${MODE_TEXT[statusPlan.mode]}`
    : statusWeekly?.text ?? `Her gün ${hours(statusPlan)} ${MODE_TEXT[statusPlan.mode]}`);
  const verifyText = verifyPlan && (!verifyPlan.enabled ? "Etkin değil" : verifyPlan.weekly
    ? weeklySummary(verifyPlan.weekly, (segment) => `${hours(segment)} ${VERIFY_TEXT[segment.verifyMode] ?? "Seçilen doğrulama yöntemi"}`).text
    : `Her gün ${hours(verifyPlan)} ${VERIFY_TEXT[verifyPlan.verifyMode] ?? "Seçilen doğrulama yöntemi"}`);
  return (
    <div className="mb-4 space-y-1 rounded-md border p-3 text-sm" aria-label="Kapıya etkisi">
      <p className="font-medium">{doorName} · Kapıya etkisi</p>
      {statusPlan && <p className={statusOpen ? "text-warning" : undefined}>Durum planı: {statusText}{statusOpen && statusWeekly?.truncated ? " · Sürekli açık aralıklar içerir" : ""}</p>}
      {verifyPlan && <p>Doğrulama planı: {verifyText}</p>}
      {holiday && <p className={holiday.enabled && holiday.mode === "remainOpen" ? "text-warning" : undefined}>Tatil planı: {holiday.enabled ? `${holiday.year} tatillerinde tam gün ${MODE_TEXT[holiday.mode]}` : "Etkin değil"}</p>}
    </div>
  );
}
