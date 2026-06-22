/**
 * Hikvision reconcile (cron) roster çekirdeği — cihaza yetkili çalışan/biyometri
 * çözümü. ctx-bağımlı (DB okur). devices.ts'in getHikDeviceFaceRoster /
 * getHikDeviceFingerprintRoster registered internalQuery wrapper'larından çağrılır.
 *
 * İki-bacak yetki çözümü (cihaz bağı + kapı bağı + isActive guard) artık TEK kaynakta:
 * `accessGraph.resolvePanelRuleMembers`. Bu modül onu çağırıp employeeId'leri toplar —
 * IDE kart roster'ı (`resolvePanelAuthorizedCards`) ile birebir aynı kural setini paylaşır.
 */
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { resolvePanelRuleMembers } from "./accessGraph";

/**
 * Bir cihaza yetkili çalışanların ID kümesi. Kanonik iki-bacak çözümünü
 * (cihaz bağı + kapı bağı + isActive guard) `resolvePanelRuleMembers`'tan alır ve
 * aktif kuralların üyelerini düzleştirir.
 */
export async function resolveAuthorizedEmployeeIds(
  ctx: QueryCtx,
  deviceId: Id<"devices">,
): Promise<Set<Id<"employees">>> {
  const { membersByRule } = await resolvePanelRuleMembers(ctx, deviceId);
  const authorizedEmpIds = new Set<Id<"employees">>();
  for (const members of membersByRule.values()) {
    for (const employeeId of members) authorizedEmpIds.add(employeeId);
  }
  return authorizedEmpIds;
}

/**
 * Yetkili çalışanlardan verilen biyometri tablosunda (employeeFaces /
 * employeeFingerprints) kaydı olanların cardNumber'larını döner. cardNumber başına
 * tek kayıt — aynı cardNumber'ı paylaşan/çok kayıtlı çalışan sayımı şişirmesin.
 * cihaz employeeNo = ngsaccess employee.cardNumber (ham trim).
 */
export async function rosterCardNumbersWithBiometric(
  ctx: QueryCtx,
  authorizedEmpIds: Set<Id<"employees">>,
  biometricTable: "employeeFaces" | "employeeFingerprints",
): Promise<string[]> {
  const seen = new Set<string>();
  for (const employeeId of authorizedEmpIds) {
    const rec = await ctx.db
      .query(biometricTable)
      .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
      .first();
    if (!rec) continue;
    const emp = await ctx.db.get(employeeId);
    const cardNumber = emp?.cardNumber?.trim();
    if (cardNumber) seen.add(cardNumber);
  }
  return Array.from(seen);
}
