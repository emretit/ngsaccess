import { v } from "convex/values";
import { adminQuery, superAdminMutation } from "./lib/customFunctions";

/**
 * IDE Smart panelleri için sistem geneli ortak MQTT kimliği (singleton).
 *
 * Admin "UUID ile ekle" yaparken (devices.registerUnassignedPanel) bu kimlik
 * cihaz satırına KOPYALANIR — bridge level-1 komut gönderirken op-zamanı
 * device.ideUser/idePassword okur, dinamik bir lookup yapmaz. Bu yüzden burada
 * değişiklik yalnızca YENİ eklenen panelleri etkiler; mevcut satırlar dokunulmaz.
 */

const FALLBACK = { ideUser: "admin", idePassword: "admin12345", ideDoorCount: 4 } as const;

/** Ortak varsayılanı döner; kayıt yoksa fallback (createIdePanel'deki eski default'larla aynı). */
export const get = adminQuery({
  args: {},
  returns: v.object({
    ideUser: v.string(),
    idePassword: v.string(),
    ideDoorCount: v.number(),
  }),
  handler: async (ctx) => {
    const row = await ctx.db.query("ideDefaults").first();
    if (!row) return { ...FALLBACK };
    return {
      ideUser: row.ideUser,
      idePassword: row.idePassword,
      ideDoorCount: row.ideDoorCount ?? FALLBACK.ideDoorCount,
    };
  },
});

/** Ortak varsayılanı günceller (yalnız super_admin). */
export const upsert = superAdminMutation({
  args: {
    ideUser: v.string(),
    idePassword: v.string(),
    ideDoorCount: v.optional(v.number()),
  },
  returns: v.id("ideDefaults"),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db.query("ideDefaults").first();
    const doorCount = Math.max(1, Math.min(args.ideDoorCount ?? FALLBACK.ideDoorCount, 8));
    if (existing) {
      await ctx.db.patch(existing._id, {
        ideUser: args.ideUser,
        idePassword: args.idePassword,
        ideDoorCount: doorCount,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("ideDefaults", {
      ideUser: args.ideUser,
      idePassword: args.idePassword,
      ideDoorCount: doorCount,
      updatedAt: now,
    });
  },
});
