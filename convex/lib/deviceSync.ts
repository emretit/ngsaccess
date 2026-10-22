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
import { fingerprintCapability } from "../fingerprintEnrollment";
import { isBiometricEnabled } from "./privacySettings";
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
  deviceId?: Id<"devices">,
): Promise<string[]> {
  const seen = new Set<string>();
  const device = biometricTable === "employeeFingerprints" && deviceId ? await ctx.db.get(deviceId) : null;
  if (biometricTable === "employeeFingerprints") {
    if (!device || device.isActive === false || device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex || fingerprintCapability(device.hikCapabilitiesSnapshot) === false || !(await isBiometricEnabled(ctx, device.projectId))) return [];
  }
  const projectEnabled = new Map<Id<"projects"> | undefined, boolean>();
  for (const employeeId of authorizedEmpIds) {
    const rec = await ctx.db
      .query(biometricTable)
      .withIndex("by_employee", (q) => q.eq("employeeId", employeeId))
      .first();
    if (!rec) continue;
    const emp = await ctx.db.get(employeeId);
    if (biometricTable === "employeeFingerprints") {
      if (!emp || emp.isActive !== true || !emp.cardNumber?.trim() || emp.projectId !== device?.projectId) continue;
      let enabled = projectEnabled.get(emp.projectId);
      if (enabled === undefined) { enabled = await isBiometricEnabled(ctx, emp.projectId); projectEnabled.set(emp.projectId, enabled); }
      if (!enabled) continue;
      const consents = await ctx.db.query("employeeConsents").withIndex("by_employee_type", q => q.eq("employeeId", employeeId).eq("consentType", "biometric_fingerprint")).take(201);
      if (consents.length > 200 || !consents.some(consent => !consent.revokedAt)) continue;
    }
    const cardNumber = emp?.cardNumber?.trim();
    if (cardNumber) seen.add(cardNumber);
  }
  return Array.from(seen);
}
