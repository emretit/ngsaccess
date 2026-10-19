import { trCalendarDate } from "./trDate";

type TimelineReading = {
  accessTime: string;
  accessStatus?: "izin_verildi" | "reddedildi";
};

export type HourBucket = { hour: number; granted: number; denied: number };

/** Okumaları İstanbul saatine göre 24 saatlik kovaya böler; belge tutmadan akışla beslenir. */
export function createHourlyCounter() {
  const hours: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, granted: 0, denied: 0 }));
  let total = 0;
  return {
    add(reading: TimelineReading) {
      const hour = trCalendarDate(reading.accessTime).getUTCHours();
      if (!Number.isInteger(hour)) return;
      // Durumu bilinmeyen okuma yalnız toplama girer (getStats ile aynı sayım).
      total += 1;
      if (reading.accessStatus === "izin_verildi") hours[hour].granted += 1;
      else if (reading.accessStatus === "reddedildi") hours[hour].denied += 1;
    },
    result() {
      return {
        hours,
        granted: hours.reduce((sum, bucket) => sum + bucket.granted, 0),
        denied: hours.reduce((sum, bucket) => sum + bucket.denied, 0),
        total,
      };
    },
  };
}
