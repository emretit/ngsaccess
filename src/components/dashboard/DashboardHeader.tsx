import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useNow } from "@/hooks/useNow";

const TIME_ZONE = "Europe/Istanbul";
const dateFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric", weekday: "long" });
const clockFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const TWO_DIGITS = { minimumIntegerDigits: 2 } as const;

export default function DashboardHeader() {
  const now = useNow(10_000);
  const clock = clockFormat.format(now);
  const [hour, minute] = clock.split(":").map(Number);
  return (
    <PageHeader title="Ana Sayfa" scope={dateFormat.format(now)}>
      {/* Dakika değişince rakamlar kayar; hareket azaltma tercihinde NumberFlow animasyonu kapatır. */}
      <p className="text-right" aria-label={`İstanbul saati ${clock}`}>
        <span aria-hidden="true" className="block text-[26px] font-[550] leading-[34px] tabular-nums tracking-[-0.025em]">
          <NumberFlowGroup>
            <NumberFlow value={hour} format={TWO_DIGITS} />
            :
            <NumberFlow value={minute} format={TWO_DIGITS} />
          </NumberFlowGroup>
        </span>
        <span aria-hidden="true" className="text-xs text-muted-foreground">İstanbul saati</span>
      </p>
    </PageHeader>
  );
}
