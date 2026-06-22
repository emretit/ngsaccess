/**
 * Hikvision reconcile (cron) roster çekirdeği — cihaza yetkili çalışan/biyometri
 * çözümü. ctx-bağımlı (DB okur). devices.ts'in getHikDeviceFaceRoster /
 * getHikDeviceFingerprintRoster registered internalQuery wrapper'larından çağrılır.
 *
 * İki-bacak yetki çözümü (cihaz bağı + kapı bağı + isActive guard) burada tek yerde;
 * `resolvePanelAuthorizedCards` ile aynı mantık ama kart yerine employeeId toplar.
 */
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Bir cihaza yetkili çalışanların ID kümesi. İki bacak: doğrudan cihaz↔grup bağı
 * (groupDevices) + cihazın kapıları üzerinden grup bağı (groupDoors). Pasif kural
 * (isActive === false) elenir; üyeler proje+grup index'iyle toplanır.
 */
export async function resolveAuthorizedEmployeeIds(
  ctx: QueryCtx,
  deviceId: Id<"devices">,
): Promise<Set<Id<"employees">>> {
  const [deviceLinks, panelDoors] = await Promise.all([
    ctx.db
      .query("groupDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .collect(),
    ctx.db
      .query("doors")
      .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
      .collect(),
  ]);

  const ruleIds = new Set<Id<"accessRules">>(deviceLinks.map((l) => l.groupId));
  await Promise.all(
    panelDoors.map(async (door) => {
      const doorLinks = await ctx.db
        .query("groupDoors")
        .withIndex("by_door", (q) => q.eq("doorId", door._id))
        .collect();
      for (const dl of doorLinks) ruleIds.add(dl.groupId);
    }),
  );

  const authorizedEmpIds = new Set<Id<"employees">>();
  await Promise.all(
    Array.from(ruleIds).map(async (ruleId) => {
      const rule = await ctx.db.get(ruleId);
      if (!rule || rule.isActive === false) return;
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", rule.projectId).eq("groupId", ruleId),
        )
        .collect();
      for (const m of members) authorizedEmpIds.add(m.employeeId);
    }),
  );

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
