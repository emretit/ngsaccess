import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { orphanPanels } from "./reconcileMath";
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
 * Bir IDE panelinin roster'ını kuralla EŞİTLER: panelde olup (idePanelUsers) artık hiçbir aktif
 * kuralla yetkisi olmayan kartları söker (deleteUser). "Güncelle"de çağrılır → re-claim veya
 * eski düzenlemelerden kalan hayalet kartları temizler.
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

  // Yetkili kartlar: bu paneli hedefleyen TÜM aktif kuralların üyeleri (union).
  const authorized = new Set<string>();
  const links = await ctx.db
    .query("groupDevices")
    .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
    .collect();
  await Promise.all(
    links.map(async (link) => {
      const rule = await ctx.db.get(link.groupId);
      if (!rule || rule.isActive === false) return;
      const members = await ctx.db
        .query("groupMembers")
        .withIndex("by_project_group", (q) =>
          q.eq("projectId", rule.projectId).eq("groupId", link.groupId),
        )
        .collect();
      await Promise.all(
        members.map(async (m) => {
          const emp = await ctx.db.get(m.employeeId);
          const card = normalizeIdeCard(emp?.cardNumber);
          if (card) authorized.add(card);
        }),
      );
    }),
  );

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
  const groupDevices = await ctx.db
    .query("groupDevices")
    .withIndex("by_project_group", (q) =>
      q.eq("projectId", projectId).eq("groupId", ruleId),
    )
    .collect();
  for (const gd of groupDevices) {
    const device = await ctx.db.get(gd.deviceId);
    if (device && device.isActive && device.brand === "ide_smart") out.add(device._id);
  }
}
