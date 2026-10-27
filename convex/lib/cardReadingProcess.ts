/**
 * Kart-okuma işleme çekirdeği — `processCardReading` / `selfCheckIn` mutation'larının
 * kullandığı yön (entry/exit) toggle'ı, panel-zaman parse'ı ve aktif-kural kesişimi.
 *
 * Saf yardımcılar (`ideTimeToISO`, `startOfTurkeyDayISO`) DB bağımsız → `cardReadingProcess.test.ts`
 * golden testleriyle donduruldu. ctx-bağımlı yardımcılar (`resolveDirection`,
 * `resolveActiveMatchingRuleIds`) `MutationCtx` alır. Güvenlik-hassas cross-tenant /
 * cihaz-doğrulama mantığı `cardReadings.processCardReading` içinde YERİNDE kalır.
 */
import { isRuleOpenAt } from "./ruleSchedule";
import { trDateKey, trDayRangeISO } from "./trDate";
import { createShiftResolver, readDepartmentPlans } from "./shiftResolver";
import { loadShiftVersions } from "./shiftVersions";
import { planShiftIds } from "./shiftPlan";
import { addWorkDate } from "./pdksWorkDay";
import { clockMinute, flexibleExitEnd, flexibleSchedule } from "./pdksFlexible";
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
// UTC ISO karşılığını döndürür.
export function startOfTurkeyDayISO(nowISO: string): string {
  return trDayRangeISO(trDateKey(nowISO), trDateKey(nowISO)).startISO;
}

const OVERNIGHT_EXIT_GRACE_MS = 4 * 60 * 60 * 1000;
const DIRECTION_ASSIGNMENT_LIMIT = 100;

/** Only the cross-day entry branch loads assignments; no shift-table scan. */
async function directionShift(ctx: MutationCtx, employeeId: Id<"employees">, date: string): Promise<Doc<"shifts"> | null> {
  const employee = await ctx.db.get(employeeId);
  if (!employee) return null;
  const assignments = await ctx.db.query("shiftAssignments")
    .withIndex("by_employee_end", q => q.eq("employeeId", employeeId).gte("endDate", date))
    .take(DIRECTION_ASSIGNMENT_LIMIT + 1);
  // An incomplete assignment set cannot safely infer yesterday's night shift.
  if (assignments.length > DIRECTION_ASSIGNMENT_LIMIT) return null;
  const departmentData = await readDepartmentPlans(ctx, employee.projectId && employee.departmentId ? [employee.projectId] : [], { start: date, end: date });
  const applicable = assignments.filter(assignment => !assignment.projectId || assignment.projectId === employee.projectId);
  const ids = [...new Set([
    ...(employee.shiftId ? [employee.shiftId] : []),
    ...[...applicable, ...departmentData.assignments].flatMap(row => [row.shiftId, ...planShiftIds(row.plan)]),
  ])];
  const shifts = (await Promise.all(ids.map(id => ctx.db.get(id))))
    .filter((shift): shift is NonNullable<typeof shift> => shift !== null)
    .filter(shift => !shift.projectId || shift.projectId === employee.projectId);
  const versions = await loadShiftVersions(ctx, shifts, date);
  const resolver = createShiftResolver([employee], shifts, [applicable], departmentData.departments, departmentData.assignments, versions);
  const plan = resolver.resolvePlan(employeeId, date);
  if (plan.kind === "shifts") return plan.shifts[plan.shifts.length - 1] ?? null;
  if (plan.kind === "rest") return null;
  // Raw access direction keeps its legacy overnight toggle; this is not PDKS eligibility.
  return employee.shiftId ? resolver.shiftAt?.(employee.shiftId, date) ?? null : null;
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

  // both → aynı projedeki cihazlar arasında çalışan oturumu
  if (!params.employeeId || !params.device) return "entry";

  const employeeId = params.employeeId;
  const last = await ctx.db
    .query("cardReadings")
    .withIndex("by_project_employee_time", (q) =>
      q.eq("projectId", params.device?.projectId).eq("employeeId", employeeId)
    )
    .filter((q) => q.eq(q.field("accessStatus"), "izin_verildi"))
    .order("desc")
    .first();

  if (!last || last.direction !== "entry" || Date.parse(params.nowISO) < Date.parse(last.accessTime)) return "entry";
  const lastDate = trDateKey(last.accessTime);
  const currentDate = trDateKey(params.nowISO);
  if (lastDate === currentDate) return "exit";
  if (lastDate !== addWorkDate(currentDate, -1)) return "entry";

  const shift = await directionShift(ctx, employeeId, lastDate);
  if (!shift) return "entry";
  const flex = flexibleSchedule(shift);
  if (shift.scheduleType === "flexible" && !flex) return "entry";
  // Invalid legacy hours are unresolved schedules, so they start a fresh day.
  let endMinute: number;
  try {
    if (flex) {
      if (flex.checkOutEndDayOffset !== 1) return "entry";
      endMinute = flexibleExitEnd(flex);
    } else {
      const start = clockMinute(shift.startTime);
      const end = clockMinute(shift.endTime);
      if (end >= start) return "entry";
      endMinute = 1440 + end;
    }
  } catch {
    return "entry";
  }
  const endMs = Date.parse(`${lastDate}T00:00:00+03:00`) + endMinute * 60000;
  return Date.parse(params.nowISO) <= endMs + OVERNIGHT_EXIT_GRACE_MS ? "exit" : "entry";
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
  nowMs: number,
): Promise<{ activeRuleIds: Set<Id<"accessRules">>; openRuleIds: Set<Id<"accessRules">> }> {
  const employeeSet = new Set(employeeGroupIds);
  const matching = deviceGroupIds.filter((gid) => employeeSet.has(gid));
  const rules = await Promise.all(matching.map((gid) => ctx.db.get(gid)));
  const activeRules = rules.filter((r): r is NonNullable<typeof r> => r?.isActive === true);
  const openRuleIds = new Set<Id<"accessRules">>();
  for (const rule of activeRules) {
    const template = rule.scheduleTemplateId ? await ctx.db.get(rule.scheduleTemplateId) : null;
    try {
      if (isRuleOpenAt(rule, nowMs, template)) openRuleIds.add(rule._id);
    } catch (error) { console.warn("Geçersiz erişim şablonu; kart erişimi kapatıldı", rule._id, error); }
  }
  return { activeRuleIds: new Set(activeRules.map(r => r._id)), openRuleIds };
}
