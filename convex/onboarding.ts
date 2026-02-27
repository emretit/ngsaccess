import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { authedMutation } from "./lib/customFunctions";

/**
 * Yeni kayıt olan kullanıcı için otomatik proje oluşturur.
 * - Kullanıcının hiç projesi yoksa yeni proje oluşturulur
 * - Kullanıcıya project_admin rolü atanır
 * - userProjects tablosuna kayıt eklenir
 *
 * Sadece doğrudan kayıt (Register sayfası) sonrası çağrılmalı.
 * Davet linki ile kayıt (UserSetup) sonrası invites.consume kullanılır.
 */
export const ensureProjectForNewUser = authedMutation({
  args: {},
  returns: v.union(v.id("projects"), v.null()),
  handler: async (ctx) => {
    const user = ctx.user;

    // super_admin zaten tüm projelere erişir
    if (user.role === "super_admin") {
      return null;
    }

    // Kullanıcının projesi var mı?
    const existing = await ctx.db
      .query("userProjects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      return null;
    }

    // Proje adı: kullanıcı adı veya email
    const projectName =
      user.fullName?.trim() ||
      user.name?.trim() ||
      (user.email ? `${user.email.split("@")[0]} Projesi` : "Yeni Proje");

    const now = new Date().toISOString();

    // 1. Proje oluştur
    const projectId = await ctx.db.insert("projects", {
      name: projectName,
      description: "Otomatik oluşturulan proje",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Kullanıcıya project_admin rolü ata
    await ctx.db.patch(user._id, {
      role: "project_admin",
      updatedAt: now,
    });

    // 3. Kullanıcıyı projeye ekle
    await ctx.db.insert("userProjects", {
      userId: user._id,
      projectId,
      createdAt: now,
    });

    return projectId;
  },
});

/**
 * Mevcut projesi olmayan tüm kullanıcılara otomatik proje atar.
 * Migration - sadece bir kez çalıştırılmalı.
 *
 * Çalıştırma: npx convex run onboarding:assignProjectsToExistingUsers '{"secret":"ADMIN_SETUP_SECRET"}'
 * veya Convex Dashboard > Functions > Run
 *
 * Gerekli: ADMIN_SETUP_SECRET env değişkeni
 */
export const assignProjectsToExistingUsers = mutation({
  args: {
    secret: v.string(),
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const expectedSecret = process.env.ADMIN_SETUP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new Error("Geçersiz gizli kod");
    }

    const users = await ctx.db.query("users").collect();
    const result = { processed: 0, created: 0, skipped: 0, errors: [] as string[] };

    for (const user of users) {
      result.processed++;

      // super_admin atla
      if (user.role === "super_admin") {
        result.skipped++;
        continue;
      }

      // Projesi var mı?
      const existing = await ctx.db
        .query("userProjects")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      if (existing) {
        result.skipped++;
        continue;
      }

      try {
        const projectName =
          user.fullName?.trim() ||
          user.name?.trim() ||
          (user.email ? `${user.email.split("@")[0]} Projesi` : "Yeni Proje");

        const now = new Date().toISOString();

        const projectId = await ctx.db.insert("projects", {
          name: projectName,
          description: "Mevcut kullanıcılar için otomatik oluşturulan proje",
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.patch(user._id, {
          role: "project_admin",
          updatedAt: now,
        });

        await ctx.db.insert("userProjects", {
          userId: user._id,
          projectId,
          createdAt: now,
        });

        result.created++;
      } catch (err) {
        result.errors.push(`${user.email ?? user._id}: ${(err as Error).message}`);
      }
    }

    return result;
  },
});
