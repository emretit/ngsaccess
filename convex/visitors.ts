import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";
import {
  findDuplicateEmployee,
  DUPLICATE_MESSAGES,
  upsertGroupMembership,
} from "./employees";
import { resolveEmployeeIdeDeviceIds } from "./lib/accessGraph";
import { writeAudit } from "./lib/audit";

/** Aktif `visitor_kvkk` rızası var mı? */
async function activeKvkkConsentId(ctx: MutationCtx, employeeId: Id<"employees">) {
  const rows = await ctx.db
    .query("employeeConsents")
    .withIndex("by_employee_type", (q) =>
      q.eq("employeeId", employeeId).eq("consentType", "visitor_kvkk"),
    )
    .collect();
  return rows.find((r) => !r.revokedAt) ?? null;
}

/** KVKK rızası yoksa kaydet + audit yaz (varsa no-op). */
async function grantKvkkConsent(
  ctx: MutationCtx,
  user: Doc<"users">,
  employeeId: Id<"employees">,
  projectId: Id<"projects"> | undefined,
) {
  if (await activeKvkkConsentId(ctx, employeeId)) return;
  const now = new Date().toISOString();
  const consentId = await ctx.db.insert("employeeConsents", {
    employeeId,
    consentType: "visitor_kvkk",
    grantedAt: now,
    grantedBy: user._id,
  });
  await writeAudit(ctx, {
    user,
    projectId: projectId ?? null,
    action: "create",
    targetTable: "employeeConsents",
    targetId: consentId,
    newValue: { consentType: "visitor_kvkk", grantedAt: now },
    note: "Ziyaretçi KVKK rızası alındı",
  });
}

// Ziyaretçi modülü (Geçici Erişim).
// Ziyaretçi = `employees` tablosunda isVisitor=true etiketli kayıt. Kart eşleştirme,
// Hikvision/IDE cihaz sync, erişim kararı ve canlı izleme altyapısı aynen kullanılır.
// Erişim, "ziyaretçi bölgesi" preset kuralına (accessRules.targetType==="visitor")
// groupMembers üyeliğiyle verilir; accessExpiresAt dolunca expireVisitorAccess cron'u
// isActive=false yapar → mevcut desync yolu cihazdan söker.

/** Form dropdown'u: "hazır ziyaretçi bölgesi" kuralları (targetType==="visitor"). */
export const presetRules = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const allowed = await getProjectIdsForUser(ctx);

    let rules: Doc<"accessRules">[];
    if (args.projectId && allowed.some((id) => id === args.projectId)) {
      rules = await ctx.db
        .query("accessRules")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else if (ctx.user.role === "super_admin") {
      rules = await ctx.db.query("accessRules").collect();
    } else if (allowed.length > 0) {
      const results = await Promise.all(
        allowed.map((pid) =>
          ctx.db
            .query("accessRules")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect(),
        ),
      );
      rules = results.flat();
    } else {
      return [];
    }

    return rules
      .filter((r) => r.targetType === "visitor")
      .map((r) => ({
        _id: r._id,
        name: r.name,
        startTime: r.startTime ?? null,
        endTime: r.endTime ?? null,
        days: r.days ?? [],
        isActive: r.isActive !== false,
        projectId: r.projectId,
      }));
  },
});

/** Ziyaretçi listesi: yalnızca isVisitor===true; host adı, bölge adı ve son okumayla zenginleştirilir. */
export const list = authedQuery({
  args: {
    projectIds: v.optional(v.array(v.id("projects"))),
    isSuperAdmin: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowed = await getProjectIdsForUser(ctx);
    const isSuper = args.isSuperAdmin === true && ctx.user.role === "super_admin";

    const all = await ctx.db
      .query("employees")
      .withIndex("by_visitor", (q) => q.eq("isVisitor", true))
      .order("desc")
      .collect();

    const visitors = isSuper
      ? all
      : all.filter((e) => e.projectId && allowed.some((id) => id === e.projectId));

    return await Promise.all(
      visitors.map(async (vz) => {
        const host = vz.hostEmployeeId ? await ctx.db.get(vz.hostEmployeeId) : null;
        const rule = vz.accessRuleId ? await ctx.db.get(vz.accessRuleId) : null;
        // Son kart okuması — "şu an binada" hesabı için (entry → içeride).
        const lastReading = await ctx.db
          .query("cardReadings")
          .withIndex("by_employee", (q) => q.eq("employeeId", vz._id))
          .order("desc")
          .first();
        // KVKK rıza durumu.
        const consents = await ctx.db
          .query("employeeConsents")
          .withIndex("by_employee_type", (q) =>
            q.eq("employeeId", vz._id).eq("consentType", "visitor_kvkk"),
          )
          .collect();
        const activeConsent = consents.find((c) => !c.revokedAt) ?? null;
        return {
          ...vz,
          host: host
            ? { _id: host._id, firstName: host.firstName, lastName: host.lastName }
            : null,
          presetRule: rule ? { _id: rule._id, name: rule.name } : null,
          lastDirection: lastReading?.direction ?? null,
          lastReadingAt: lastReading?.accessTime ?? null,
          hasKvkkConsent: !!activeConsent,
          kvkkConsentAt: activeConsent?.grantedAt ?? null,
        };
      }),
    );
  },
});

/** Ziyaretçi oluştur: employees(isVisitor=true) + preset kuralına üyelik + cihaz sync. */
export const create = adminMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    cardNumber: v.string(),
    presetRuleId: v.id("accessRules"),
    accessExpiresAt: v.string(),
    accessStartsAt: v.optional(v.string()),
    visitorPhone: v.optional(v.string()),
    visitorCompany: v.optional(v.string()),
    visitPurpose: v.optional(v.string()),
    hostEmployeeId: v.optional(v.id("employees")),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    kvkkConsent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowed = await getProjectIdsForUser(ctx);
    const isSuper = ctx.user.role === "super_admin";
    // Tenant izolasyonu: super hariç, referans verilen kayıt yetkili bir projede olmalı.
    const inAllowed = (pid: Id<"projects"> | undefined) =>
      isSuper || (!!pid && allowed.some((id) => id === pid));

    if (args.projectId && !inAllowed(args.projectId)) {
      throw new Error("Bu projeye erişim yetkiniz yok");
    }

    const rule = await ctx.db.get(args.presetRuleId);
    if (!rule || rule.targetType !== "visitor") {
      throw new Error("Geçerli bir ziyaretçi bölgesi seçin");
    }
    if (!inAllowed(rule.projectId)) {
      throw new Error("Bu ziyaretçi bölgesine erişim yetkiniz yok");
    }

    const cardNumber = args.cardNumber.trim();
    if (!cardNumber) throw new Error("Kart numarası zorunludur");
    const dupCard = await findDuplicateEmployee(ctx, "cardNumber", cardNumber);
    if (dupCard) {
      // İade edilen rozet: SADECE yetkili projedeki pasif bir ziyaretçinin kartıysa serbest
      // bırak (reclaim). Başka tenant'ın kaydı asla değiştirilmez.
      if (
        dupCard.isVisitor === true &&
        dupCard.isActive === false &&
        inAllowed(dupCard.projectId)
      ) {
        await ctx.db.patch(dupCard._id, {
          cardNumber: `IADE:${cardNumber}:${dupCard._id}`,
          updatedAt: new Date().toISOString(),
        });
      } else {
        throw new Error(DUPLICATE_MESSAGES.cardNumber);
      }
    }

    // E-posta employees'te zorunlu; ziyaretçi için verilmezse BENZERSIZ sentetik üret.
    // Karta dayalı üretmiyoruz: kart tekrar kullanılınca (reclaim) eski kaydın email'i
    // sabit kaldığı için çakışırdı; UUID ile her kayıt benzersiz.
    const providedEmail = args.email?.trim().toLowerCase();
    const email = providedEmail || `ziyaretci-${crypto.randomUUID()}@ngsaccess.local`;
    if (providedEmail) {
      const dupEmail = await findDuplicateEmployee(ctx, "email", email);
      if (dupEmail) throw new Error(DUPLICATE_MESSAGES.email);
    }

    const isActive = args.isActive ?? true;
    const now = new Date().toISOString();
    const id = await ctx.db.insert("employees", {
      projectId: args.projectId,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      email,
      cardNumber,
      accessRuleId: args.presetRuleId,
      isActive,
      isVisitor: true,
      visitorStatus: isActive ? "checkedIn" : "preRegistered",
      accessExpiresAt: args.accessExpiresAt,
      accessStartsAt: args.accessStartsAt ?? now,
      visitorPhone: args.visitorPhone?.trim() || undefined,
      visitorCompany: args.visitorCompany?.trim() || undefined,
      visitPurpose: args.visitPurpose?.trim() || undefined,
      hostEmployeeId: args.hostEmployeeId,
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    await upsertGroupMembership(ctx, id, args.presetRuleId, args.projectId);
    if (args.kvkkConsent) {
      await grantKvkkConsent(ctx, ctx.user, id, args.projectId);
    }
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
      employeeId: id,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.actions.ideGatewayDevice.syncEmployeeToIdePanels,
      { employeeId: id },
    );
    return id;
  },
  returns: v.id("employees"),
});

/**
 * Ziyaretçi güncelle. Bölge (preset kural) v1'de değiştirilemez — gerekirse sil + yeniden
 * oluştur. Kart değişiminde eski kart IDE panellerinden sökülür (employees.update deseni).
 * accessExpiresAt değişimi cihaz sync gerektirmez (süre dolumu cron işidir).
 */
export const update = adminMutation({
  args: {
    visitorId: v.id("employees"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    cardNumber: v.optional(v.string()),
    accessExpiresAt: v.optional(v.string()),
    visitorPhone: v.optional(v.string()),
    visitorCompany: v.optional(v.string()),
    visitPurpose: v.optional(v.string()),
    hostEmployeeId: v.optional(v.id("employees")),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    kvkkConsent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.isVisitor !== true) throw new Error("Ziyaretçi bulunamadı");
    const allowed = await getProjectIdsForUser(ctx);
    if (visitor.projectId && !allowed.some((id) => id === visitor.projectId)) {
      throw new Error("Bu ziyaretçiye erişim yetkiniz yok");
    }

    const newCard = args.cardNumber?.trim();
    const cardChanged = newCard !== undefined && newCard !== visitor.cardNumber;
    if (cardChanged) {
      if (!newCard) throw new Error("Kart numarası zorunludur");
      const dup = await findDuplicateEmployee(ctx, "cardNumber", newCard, args.visitorId);
      if (dup) throw new Error(DUPLICATE_MESSAGES.cardNumber);
    }
    const activeChanged = args.isActive !== undefined && args.isActive !== visitor.isActive;

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.firstName !== undefined) patch.firstName = args.firstName.trim();
    if (args.lastName !== undefined) patch.lastName = args.lastName.trim();
    if (args.visitorPhone !== undefined) patch.visitorPhone = args.visitorPhone.trim() || undefined;
    if (args.visitorCompany !== undefined) patch.visitorCompany = args.visitorCompany.trim() || undefined;
    if (args.visitPurpose !== undefined) patch.visitPurpose = args.visitPurpose.trim() || undefined;
    if (args.hostEmployeeId !== undefined) patch.hostEmployeeId = args.hostEmployeeId;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.accessExpiresAt !== undefined) patch.accessExpiresAt = args.accessExpiresAt;
    if (cardChanged) patch.cardNumber = newCard;
    if (activeChanged) {
      patch.isActive = args.isActive;
      patch.visitorStatus = args.isActive ? "checkedIn" : "checkedOut";
    }
    await ctx.db.patch(args.visitorId, patch);

    // Kart değiştiyse ESKİ kartı IDE panellerinden sök (orphan kalmasın).
    if (cardChanged) {
      const ideDeviceIds = await resolveEmployeeIdeDeviceIds(
        ctx,
        args.visitorId,
        visitor.projectId,
      );
      if (ideDeviceIds.length > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.ideGatewayDevice.deleteIdeUserFromPanels,
          { cardNumber: visitor.cardNumber, deviceIds: ideDeviceIds, projectId: visitor.projectId },
        );
      }
    }
    if (cardChanged || activeChanged) {
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
        employeeId: args.visitorId,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.actions.ideGatewayDevice.syncEmployeeToIdePanels,
        { employeeId: args.visitorId },
      );
    }
    if (args.kvkkConsent) {
      await grantKvkkConsent(ctx, ctx.user, args.visitorId, visitor.projectId);
    }
    return args.visitorId;
  },
  returns: v.id("employees"),
});

/** Manuel çıkış: erişimi geri al (isActive=false → cihazdan söker), durumu checkedOut yap. */
export const checkOut = adminMutation({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.isVisitor !== true) throw new Error("Ziyaretçi bulunamadı");
    const allowed = await getProjectIdsForUser(ctx);
    if (visitor.projectId && !allowed.some((id) => id === visitor.projectId)) {
      throw new Error("Bu ziyaretçiye erişim yetkiniz yok");
    }
    if (visitor.isActive === false) return args.visitorId;
    await ctx.db.patch(args.visitorId, {
      isActive: false,
      visitorStatus: "checkedOut",
      updatedAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
      employeeId: args.visitorId,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.actions.ideGatewayDevice.syncEmployeeToIdePanels,
      { employeeId: args.visitorId },
    );
    return args.visitorId;
  },
  returns: v.id("employees"),
});

/** Pasif ziyaretçinin kartını elle serbest bırak (rozet iadesi). Saf DB — cihaz işlemi yok. */
export const releaseCard = adminMutation({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.isVisitor !== true) throw new Error("Ziyaretçi bulunamadı");
    const allowed = await getProjectIdsForUser(ctx);
    if (visitor.projectId && !allowed.some((id) => id === visitor.projectId)) {
      throw new Error("Bu ziyaretçiye erişim yetkiniz yok");
    }
    if (visitor.isActive !== false) {
      throw new Error("Önce ziyaretçiyi çıkış yaptırın");
    }
    if (visitor.cardNumber.startsWith("IADE:")) return args.visitorId; // zaten serbest
    await ctx.db.patch(args.visitorId, {
      cardNumber: `IADE:${visitor.cardNumber}:${args.visitorId}`,
      updatedAt: new Date().toISOString(),
    });
    return args.visitorId;
  },
  returns: v.id("employees"),
});

/** Cron: süresi dolan aktif ziyaretçileri pasife çek → mevcut desync yolu erişimi geri alır. */
export const expireVisitorAccess = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const expired = await ctx.db
      .query("employees")
      .withIndex("by_visitor_active_expiry", (q) =>
        q.eq("isVisitor", true).eq("isActive", true).lte("accessExpiresAt", now),
      )
      .collect();
    for (const vz of expired) {
      await ctx.db.patch(vz._id, {
        isActive: false,
        visitorStatus: "expired",
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
        employeeId: vz._id,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.actions.ideGatewayDevice.syncEmployeeToIdePanels,
        { employeeId: vz._id },
      );
    }
    return { expired: expired.length };
  },
  returns: v.object({ expired: v.number() }),
});
