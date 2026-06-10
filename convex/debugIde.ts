import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { resolvePanelAuthorizedCards } from "./lib/accessGraph";

/**
 * reconcilePanelRosterIde'nin READ-ONLY ikizi (dry-run): paneli hedefleyen kural
 * bacaklarını ve reconcile koşsa silinECEK kartları raporlar; hiçbir şey silmez,
 * hiçbir job schedule etmez. Aynı mantığı resolvePanelAuthorizedCards'tan aldığı
 * için gerçek reconcile'dan ayrışamaz.
 *
 * Kullanım: npx convex run debugIde:panelRosterDiff '{"deviceId":"<devices id>"}'
 *
 * Saha kontrolü: deploy sonrası, herhangi bir kural Güncelle/deaktivasyonundan ÖNCE
 * her ide_smart panelde koşulur; `wouldDelete` beklenmedik gerçek kart içeriyorsa
 * reconcile tetiklenmeden incelenmeli. `doorOnlyRuleIds` (kapı bağı var, cihaz bağı
 * yok) API/legacy izi — stale-groupDoors denetimi için.
 */
export const panelRosterDiff = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const panel = await ctx.db.get(args.deviceId);
    if (!panel || panel.brand !== "ide_smart" || !panel.ideUuid) {
      return {
        ok: false as const,
        reason: "Cihaz yok, ide_smart değil ya da ideUuid atanmamış",
      };
    }
    const ideUuid = panel.ideUuid;

    const { deviceLegRuleIds, doorLegRuleIds, authorized } =
      await resolvePanelAuthorizedCards(ctx, args.deviceId);

    const deviceLeg = new Set(deviceLegRuleIds);
    const doorOnlyRuleIds = doorLegRuleIds.filter((id) => !deviceLeg.has(id));

    const allRuleIds = Array.from(new Set([...deviceLegRuleIds, ...doorLegRuleIds]));
    const ruleDocs = await Promise.all(allRuleIds.map((id) => ctx.db.get(id)));

    const onPanelRows = await ctx.db
      .query("idePanelUsers")
      .withIndex("by_uuid", (q) => q.eq("ideUuid", ideUuid))
      .collect();
    const onPanel = onPanelRows.map((r) => r.cardNumber).sort();
    const wouldDelete = onPanel.filter((card) => !authorized.has(card));

    return {
      ok: true as const,
      panel: { _id: panel._id, name: panel.name, ideUuid },
      rules: ruleDocs
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .map((r) => ({ _id: r._id, name: r.name, isActive: r.isActive })),
      deviceLegRuleIds,
      doorLegRuleIds,
      doorOnlyRuleIds,
      authorized: Array.from(authorized).sort(),
      onPanel,
      wouldDelete,
    };
  },
});
