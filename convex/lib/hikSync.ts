// hikGateway.ts node-only (digestAuth → crypto). Sadece "use node" action'lardan
// import edildiği için chain Node bundle'a girer.
"use node";

import type { Doc, Id } from "../_generated/dataModel";
import { ALL_DAYS, type Weekday, type WeekScheduleEntry } from "./hikGateway";

/**
 * Hik gateway sync için ortak helper'lar — `actions/hikvisionSync.ts` ve
 * Phase 3 worker (hikQueueWorker) buradan ortak filtreleme yapar.
 */

export interface HikSyncEligibleDevice {
  _id: Id<"devices">;
  brand?: "hikvision" | "other" | "ide_smart";
  hikDevIndex?: string;
  projectId?: Id<"projects">;
  name: string;
}

/**
 * Sadece gateway sync'ine uygun cihazlar:
 *  - brand === "hikvision"
 * `hikDevIndex` check'i caller'a bırakılır — bazı caller'lar register'sız
 * cihaz için "kayıt yok" hatasını UI'da görmek isteyebilir.
 */
export function filterHikvisionDevices<T extends { brand?: string }>(devices: T[]): T[] {
  return devices.filter((d) => d.brand === "hikvision");
}

/**
 * Sync için tam uygun: hikvision marka + gateway'e register edilmiş.
 */
export function filterRegisteredHikvisionDevices<
  T extends { brand?: string; hikDevIndex?: string },
>(devices: T[]): T[] {
  return devices.filter((d) => d.brand === "hikvision" && !!d.hikDevIndex);
}

/**
 * Devices tablosundan dönen tam Doc tipi için tip alias.
 */
export type DeviceDoc = Doc<"devices">;

/**
 * Kural saat/gün alanlarını cihaza gönderilecek schedule'a çevirir.
 *   - startTime/endTime boş → "00:00" / "23:59" (7/24 erişim)
 *   - days hiç verilmemiş veya tüm element'ler boş → 7 günün hepsi açık
 *   - days non-empty ama hiçbiri Weekday değil → boş schedule (tamamen kapalı)
 * Bu ayrım kritik: lowercase/yanlış format gelen kayıtların sessizce 24/7
 * açılmasını önler. Cihaza endTime saniye `:59` gider — DS-K1T8 `23:59:59`
 * (dakikanın son saniyesi) bekler.
 */
export function defaultRuleSchedule(rule: {
  startTime?: string;
  endTime?: string;
  days?: string[];
}): WeekScheduleEntry[] {
  const start = (rule.startTime ?? "").trim() || "00:00";
  const end = (rule.endTime ?? "").trim() || "23:59";
  const rawDays = rule.days?.filter((d): d is string => !!d) ?? [];
  const days: readonly Weekday[] =
    rawDays.length === 0
      ? ALL_DAYS
      : rawDays.filter((d): d is Weekday =>
          (ALL_DAYS as readonly string[]).includes(d),
        );
  return days.map((week) => ({
    week,
    beginTime: `${start}:00`,
    endTime: `${end}:59`,
  }));
}
