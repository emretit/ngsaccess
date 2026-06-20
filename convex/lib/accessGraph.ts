import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { orphanPanels } from "./reconcileMath";
import { computeAuthorizedCards } from "./accessGraphPure";
import { normalizeIdeCard } from "../ideSync";

/**
 * Erişim grafı çözümleme yardımcıları (groupMembers → kural → groupDevices → cihaz).
 *
 * IDE Smart panellerinde orphan user/permission bırakmamak için, kayıt/üyelik silinmeden
 * ya da kart no değişmeden ÖNCE hangi panellerin etkilendiğini mutation içinde çözmek
 * gerekir (scheduler.runAfter commit sonrası çalıştığından bu zincir o noktada gezilemez).
 */

/** Bir çalışanın bağlı olduğu (aktif kural → aktif ide_smart cihaz) IDE panel deviceId'leri. */
export async function resolveEmployeeIdeDeviceIds(
  ctx: MutationCtx,
  employeeId: Id<"employees">,
  projectId: Id<"projects"> | undefined,
): Promise<Id<"devices">[]> {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_project_employee", (q) =>
      q.eq("projectId", projectId).eq("employeeId", employeeId),
    )
    .collect();
  const deviceIds = new Set<Id<"devices">>();
  await Promise.all(
    memberships.map(async (gm) => {
      const rule = await ctx.db.get(gm.groupId);
      if (!rule || !rule.isActive) return;
      await collectRuleIdeDevices(ctx, gm.groupId, projectId, deviceIds);
    }),
  );
  return Array.from(deviceIds);
}

/** Bir kuralın (grubun) bağlı olduğu IDE Smart panel deviceId'leri (kural aktif/pasif farketmez). */
export async function resolveRuleIdeDeviceIds(
  ctx: MutationCtx,
  ruleId: Id<"accessRules">,
  projectId: Id<"projects"> | undefined,
): Promise<Id<"devices">[]> {
  const deviceIds = new Set<Id<"devices">>();
  await collectRuleIdeDevices(ctx, ruleId, projectId, deviceIds);
  return Array.from(deviceIds);
}

/**
 * Bir çalışan bir kuraldan/cihazdan çıkarıldığında IDE panellerinde yetkisini düzeltir.
 * `candidatePanels` = bu işlemle erişimini kaybetmiş olabileceği paneller (silmeden ÖNCE çözülür).
 *
 * Çalışanın KALAN panelleri (başka aktif kurallarından) çıkarılır; gerçek orphan'larda
 * `deleteUser` (panelden tamamen sök), kalan panellerde `syncEmployeeToIdePanels` ile
 * `permissions[]` AZALTILIR (kişi silinmez). İki-gruplu (sabah/akşam) senaryonun çekirdeği.
 *
 * NOT: çağıran mutation üyelik/cihaz satırlarını SİLDİKTEN SONRA çağırmalı ki `remaining`
 * düzenleme-sonrası durumu yansıtsın; `candidatePanels` ise silmeden ÖNCE yakalanmalı.
 */
export async function reconcileRemovedEmployeeIde(
  ctx: MutationCtx,
  args: {
    employeeId: Id<"employees">;
    projectId: Id<"projects"> | undefined;
    candidatePanels: Id<"devices">[];
  },
): Promise<void> {
  const employee = await ctx.db.get(args.employeeId);
  if (employee && args.candidatePanels.length > 0) {
    const remaining = await resolveEmployeeIdeDeviceIds(
      ctx,
      args.employeeId,
      args.projectId,
    );
    const orphans = orphanPanels(args.candidatePanels, remaining);
    if (orphans.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.ideGatewayDevice.deleteIdeUserFromPanels,
        {
          cardNumber: employee.cardNumber,
          deviceIds: orphans,
          projectId: args.projectId,
        },
      );
    }
  }
  await ctx.scheduler.runAfter(
    0,
    internal.actions.ideGatewayDevice.syncEmployeeToIdePanels,
    { employeeId: args.employeeId },
  );
}

/**
 * Bir paneli hedefleyen kuralları İKİ bacaktan çözer ve aktif olanların üye kartlarını
 * (normalize) döndürür:
 *   A) cihaz bağı — groupDevices.deviceId = panel
 *   B) kapı bağı  — doors.deviceId = panel → groupDoors.doorId (CANLI doors.deviceId'den
 *      gidilir; groupDoors.deviceId insert-anı snapshot'ıdır, taşınmış kapı eski panelde
 *      yetki üretmesin — getRuleIoIdsForPanel'in canlı kontrolüyle tutarlı).
 *
 * Bilinçli asimetri: push hattı (syncEmployeeToIdePanels → getEmployeeWithDevices) yalnız
 * cihaz bağını yazar; kapı bacağı burada yalnız KORUR (muhafazakar silme) — kapı bağıyla
 * yetkili ama panelde olmayan kişiyi panele YAZMAZ.
 *
 * QueryCtx alır ki read-only dry-run ikizi (debugIde.panelRosterDiff) birebir aynı
 * mantığı kullanabilsin — iki kopyanın sessizce ayrışması bu fonksiyonun en büyük riski.
 */
export async function resolvePanelAuthorizedCards(
  ctx: QueryCtx,
  deviceId: Id<"devices">,
  normalizeCard: (card: unknown) => string | null = normalizeIdeCard,
): Promise<{
  deviceLegRuleIds: Id<"accessRules">[];
  doorLegRuleIds: Id<"accessRules">[];
  authorized: Set<string>;
}> {
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
  const deviceLeg = new Set<Id<"accessRules">>(deviceLinks.map((l) => l.groupId));
  const doorLeg = new Set<Id<"accessRules">>();
  await Promise.all(
    panelDoors.map(async (door) => {
      const doorLinks = await ctx.db
        .query("groupDoors")
        .withIndex("by_door", (q) => q.eq("doorId", door._id))
        .collect();
      for (const dl of doorLinks) doorLeg.add(dl.groupId);
    }),
  );

  // Benzersiz kural başına üyeler BİR kez çekilir (iki bacakta da görünen kural,
  // duplicate groupDevices satırı vb. yinelenen okuma üretmez). DB'den toplanan
  // aktif kural/üye/kart verisi saf çekirdeğe (computeAuthorizedCards) verilir.
  const ruleIds = new Set<Id<"accessRules">>([...deviceLeg, ...doorLeg]);
  const activeRuleIds = new Set<Id<"accessRules">>();
  const membersByRule = new Map<Id<"accessRules">, Id<"employees">[]>();
  const cardByEmployee = new Map<Id<"employees">, unknown>();
  await Promise.all(
    Array.from(ruleIds).map(async (ruleId) => {
      const rule = await ctx.db.get(ruleId);
      if (!rule || rule.isActive === false) return;
      activeRuleIds.add(ruleId);
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", rule.projectId).eq("groupId", ruleId),
        )
        .collect();
      membersByRule.set(ruleId, members.map((m) => m.employeeId));
      await Promise.all(
        members.map(async (m) => {
          if (cardByEmployee.has(m.employeeId)) return;
          const emp = await ctx.db.get(m.employeeId);
          cardByEmployee.set(m.employeeId, emp?.cardNumber);
        }),
      );
    }),
  );
  const authorized = computeAuthorizedCards({
    ruleIds,
    activeRuleIds,
    membersByRule,
    cardByEmployee,
    normalizeCard,
  });
  return {
    deviceLegRuleIds: Array.from(deviceLeg),
    doorLegRuleIds: Array.from(doorLeg),
    authorized,
  };
}

/**
 * Bir IDE panelinin roster'ını kuralla EŞİTLER: panelde olup (idePanelUsers) artık hiçbir aktif
 * kuralla yetkisi olmayan kartları söker (deleteUser). "Güncelle"de çağrılır → re-claim veya
 * eski düzenlemelerden kalan hayalet kartları temizler. Yetki kümesi cihaz VEYA kapı bağıyla
 * kurulur (resolvePanelAuthorizedCards) — yalnız kapı bağıyla yetkili üye hayalet sayılmaz.
 *
 * ÖLÇEKLENİR: yalnız (panelde-olan − yetkili) farkı için deleteUser üretir; 1000 kullanıcıda
 * tüm roster taranmaz, sadece gerçek fazlalıklar silinir. idePanelUsers ideUuid bazlı olduğundan
 * panelin device _id'si değişmiş olsa bile (re-claim) doğru roster bulunur.
 *
 * NOT: çağıran mutation üyelik/cihaz satırlarını GÜNCELLEDİKTEN sonra çağırmalı ki "yetkili"
 * kümesi düzenleme-sonrası durumu yansıtsın.
 */
export async function reconcilePanelRosterIde(
  ctx: MutationCtx,
  args: { deviceId: Id<"devices">; projectId: Id<"projects"> | undefined },
): Promise<void> {
  const panel = await ctx.db.get(args.deviceId);
  if (!panel || panel.brand !== "ide_smart" || !panel.ideUuid) return;
  const ideUuid = panel.ideUuid;

  // Yetkili kartlar: bu paneli (cihaz ∪ kapı bağı) hedefleyen TÜM aktif kuralların üyeleri.
  const { authorized } = await resolvePanelAuthorizedCards(ctx, args.deviceId);

  // Panelde olan (roster yansıması) − yetkili = sökülecek hayaletler.
  const onPanel = await ctx.db
    .query("idePanelUsers")
    .withIndex("by_uuid", (q) => q.eq("ideUuid", ideUuid))
    .collect();
  for (const row of onPanel) {
    if (authorized.has(row.cardNumber)) continue;
    await ctx.scheduler.runAfter(
      0,
      internal.actions.ideGatewayDevice.deleteIdeUserFromPanels,
      {
        cardNumber: row.cardNumber,
        deviceIds: [args.deviceId],
        projectId: args.projectId,
      },
    );
  }
}

async function collectRuleIdeDevices(
  ctx: MutationCtx,
  ruleId: Id<"accessRules">,
  projectId: Id<"projects"> | undefined,
  out: Set<Id<"devices">>,
): Promise<void> {
  // Kapı bağı: kuralın seçili kapıları → CANLI doors.deviceId → panel. by_group bilinçli
  // (by_project_group değil): groupDoors okumaları her yerde by_group/by_door desenli ve
  // projectId backfill migration'ı bu tabloyu kapsamıyor — eksik satır kaçırmayalım.
  const [groupDevices, groupDoors] = await Promise.all([
    ctx.db
      .query("groupDevices")
      .withIndex("by_project_group", (q) =>
        q.eq("projectId", projectId).eq("groupId", ruleId),
      )
      .collect(),
    ctx.db
      .query("groupDoors")
      .withIndex("by_group", (q) => q.eq("groupId", ruleId))
      .collect(),
  ]);
  await Promise.all([
    ...groupDevices.map(async (gd) => {
      const device = await ctx.db.get(gd.deviceId);
      if (device && device.isActive && device.brand === "ide_smart") out.add(device._id);
    }),
    ...groupDoors.map(async (gd) => {
      const door = await ctx.db.get(gd.doorId);
      if (!door?.deviceId) return;
      const device = await ctx.db.get(door.deviceId);
      if (device && device.isActive && device.brand === "ide_smart") out.add(device._id);
    }),
  ]);
}
