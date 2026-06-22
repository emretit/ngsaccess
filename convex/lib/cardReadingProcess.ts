/**
 * Kart-okuma işleme çekirdeği — `processCardReading` / `selfCheckIn` mutation'larının
 * kullandığı yön (entry/exit) toggle'ı, panel-zaman parse'ı ve aktif-kural kesişimi.
 *
 * Saf yardımcılar (`ideTimeToISO`, `startOfTurkeyDayISO`) DB bağımsız → `cardReadingProcess.test.ts`
 * golden testleriyle donduruldu. ctx-bağımlı yardımcılar (`resolveDirection`,
 * `resolveActiveMatchingRuleIds`) `MutationCtx` alır. Güvenlik-hassas cross-tenant /
 * cihaz-doğrulama mantığı `cardReadings.processCardReading` içinde YERİNDE kalır.
 */
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type AccessDirection = "entry" | "exit";

// IDE Smart panel olay zamanı ("YYYY-MM-DD HH:MM:SS", panel TZ = UTC+3) → UTC ISO.
// Geçersiz/boş ise undefined döner (çağıran sunucu alış anına düşer).
export function ideTimeToISO(ideTime: string | undefined): string | undefined {
  if (!ideTime) return undefined;
  const m = ideTime.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!m) return undefined;
  // Panel saatini UTC+3 kabul edip ISO offset'li string olarak ver; Date doğrular.
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+03:00`;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString();
}

// Türkiye saatiyle (UTC+3, DST yok) verilen ISO timestamp'inin günü başlangıcının
// UTC ISO karşılığını döndürür. Toggle'ı günlük resetlemek için kullanılır.
export function startOfTurkeyDayISO(nowISO: string): string {
  const tr = new Date(new Date(nowISO).getTime() + 3 * 60 * 60 * 1000);
  const y = tr.getUTCFullYear();
  const m = String(tr.getUTCMonth() + 1).padStart(2, "0");
  const d = String(tr.getUTCDate()).padStart(2, "0");
  // TR günü 00:00 = UTC önceki günün 21:00
  return `${y}-${m}-${d}T00:00:00.000+03:00`;
}

// Cihazın yön ayarına ve toggle state'ine göre okumanın yönünü çözer.
export async function resolveDirection(
  ctx: MutationCtx,
  params: {
    device: Doc<"devices"> | null;
    employeeId: Id<"employees"> | null;
    nowISO: string;
    /** IDE Smart panel: hangi aktüatör/kapıdan geçildi (io_id). */
    ideIoId?: number;
  }
): Promise<AccessDirection> {
  // IDE Smart paneli: yön kapı (io_id) düzeyinde. Varsayılan adlandırma io 0=Giriş, 1=Çıkış.
  if (params.device?.brand === "ide_smart" && params.ideIoId !== undefined) {
    if (params.ideIoId === 0) return "entry";
    if (params.ideIoId === 1) return "exit";
    // Diğer kapılar için cihaz/çalışan toggle'ına düş.
  }

  const cfg = params.device?.accessDirection ?? "both";
  if (cfg === "entry") return "entry";
  if (cfg === "exit") return "exit";

  // both → çalışan + cihaz çiftine göre toggle
  if (!params.employeeId || !params.device) return "entry";

  const startOfDay = startOfTurkeyDayISO(params.nowISO);
  const last = await ctx.db
    .query("cardReadings")
    .withIndex("by_employee_device_time", (q) =>
      q.eq("employeeId", params.employeeId!).eq("deviceId", params.device!._id)
    )
    .filter((q) => q.eq(q.field("accessStatus"), "izin_verildi"))
    .order("desc")
    .first();

  if (!last || last.accessTime < startOfDay) return "entry";
  return last.direction === "entry" ? "exit" : "entry";
}

/**
 * Cihaz ∩ çalışan kesişimindeki kurallardan AKTİF olanların id kümesini çözer.
 * Saf karar (`canEmployeeAccessDevice`) için gereken tek DB-bağımlı adım: yalnız
 * kesişimdeki kuralları okur (tüm kuralları değil) — küçük küme, ucuz.
 */
export async function resolveActiveMatchingRuleIds(
  ctx: MutationCtx,
  deviceGroupIds: Id<"accessRules">[],
  employeeGroupIds: Id<"accessRules">[],
): Promise<Set<Id<"accessRules">>> {
  const employeeSet = new Set(employeeGroupIds);
  const matching = deviceGroupIds.filter((gid) => employeeSet.has(gid));
  const rules = await Promise.all(matching.map((gid) => ctx.db.get(gid)));
  return new Set(
    rules
      .filter((r): r is NonNullable<typeof r> => r?.isActive === true)
      .map((r) => r._id),
  );
}
