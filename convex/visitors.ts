import { validateVisitorPresetCard } from "./lib/mobileVisitors";
import { visitorQueryNow } from "./lib/visitorStatus";
import { mergedStream, stream } from "convex-helpers/server/stream";
import schema from "./schema";
import { paginationOptsValidator } from "convex/server";
import { visitorTimeISO, visitorSensitiveFields, maskedVisitorCard, visitorMatchesSearch, visitorStatus, visitorTime, visitorExpiryValidation, visitorUpdateExpiryError } from "./lib/visitorStatus";
import { resolveProjectScope } from "./lib/projectScope";
import { assertAccessProjectUnchanged } from "./lib/accessScope";
import { validateVisitorAccessRelations } from "./lib/accessScopeRelations";
import { toPatch } from "./lib/nullablePatch";
import { visitorPresence, visitorDetailsError } from "./lib/visitorPresence";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { isManager, requireEmployeeAccess } from "./lib/auth";
import { Doc, Id } from "./_generated/dataModel";
import {
  findDuplicateEmployee,
  DUPLICATE_MESSAGES,
  upsertGroupMembership,
} from "./employees";
import { resolveEmployeeIdeDeviceIds } from "./lib/accessGraph";
import { writeAudit } from "./lib/audit";

/** Aktif `visitor_kvkk` rızası var mı? */
async function activeKvkkConsentId(ctx: QueryCtx | MutationCtx, employeeId: Id<"employees">) {
  const rows = ctx.db
    .query("employeeConsents")
    .withIndex("by_employee_type", (q) =>
      q.eq("employeeId", employeeId).eq("consentType", "visitor_kvkk"),
    ).order("desc");
  for await (const row of rows) {
    if (!row.revokedAt) return row;
  }
  return null;
}

/** KVKK rızası yoksa kaydet + audit yaz (varsa no-op). */
async function grantKvkkConsent(
  ctx: MutationCtx,
  user: Doc<"users">,
  employeeId: Id<"employees">,
  projectId: Id<"projects"> | undefined,
  approvedVersion: string | undefined,
) {
  if (await activeKvkkConsentId(ctx, employeeId)) return;
  const notice = await visitorKvkkNotice(ctx, projectId);
  if (!notice.url || !notice.version) throw new Error("Aydınlatma metni henüz tanımlanmadı");
  if (approvedVersion !== notice.version) throw new Error("Aydınlatma metni güncellendi. Güncel metni inceleyip rıza kaydını yeniden işaretleyin.");
  const now = new Date().toISOString();
  const consentId = await ctx.db.insert("employeeConsents", {
    employeeId,
    consentType: "visitor_kvkk",
    documentUrl: notice.url,
    documentVersion: notice.version,
    grantedAt: now,
    grantedBy: user._id,
  });
  await writeAudit(ctx, {
    user,
    projectId: projectId ?? null,
    action: "create",
    targetTable: "employeeConsents",
    targetId: consentId,
    newValue: { consentType: "visitor_kvkk", grantedAt: now, documentVersion: notice.version, documentUrl: notice.url },
    note: "Ziyaretçi KVKK rızası alındı",
  });
}

async function visitorKvkkNotice(ctx: QueryCtx | MutationCtx, projectId: Id<"projects"> | undefined) {
  const row = projectId ? await ctx.db.query("projectPrivacySettings").withIndex("by_project", q => q.eq("projectId", projectId)).first() : null;
  const url = row?.visitorKvkkUrl?.trim();
  return { url: url && /^https?:\/\//i.test(url) ? url : null, version: row?.visitorKvkkVersion?.trim() || null };
}

export const kvkkNotice = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    return visitorKvkkNotice(ctx, args.projectId);
  },
});

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
    const allowed = await resolveProjectScope(ctx, args.projectId);
    const rules = (await Promise.all(allowed.map(projectId =>
      ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ))).flat();

    return Promise.all(rules.filter(r => r.targetType === "visitor").map(async r => {
      const directDoor = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", r._id)).first();
      let hasDoors = directDoor !== null;
      if (!hasDoors) {
        const devices = ctx.db.query("groupDevices").withIndex("by_group", q => q.eq("groupId", r._id));
        for await (const member of devices) {
          const door = await ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", member.deviceId)).first();
          if (door?.projectId === r.projectId) { hasDoors = true; break; }
        }
      }
      return {
        _id: r._id, name: r.name, startTime: r.startTime ?? null,
        endTime: r.endTime ?? null, days: r.days ?? [], isActive: r.isActive !== false,
        projectId: r.projectId, hasDoors,
      };
    }));
  },
});

// İzinli son olay ve aynı andaki yön çelişkisi; patolojik eşzamanlı yoğunlukta bilinmiyor.
async function latestVisitorPresence(ctx: QueryCtx, visitor: Doc<"employees">) {
  const latest = await ctx.db.query("cardReadings")
    .withIndex("by_employee_status_time", q => q.eq("employeeId", visitor._id).eq("accessStatus", "izin_verildi"))
    .order("desc").first();
  if (!latest || latest.projectId !== visitor.projectId) return visitorPresence([]);
  const simultaneous = await ctx.db.query("cardReadings")
    .withIndex("by_employee_status_time", q => q.eq("employeeId", visitor._id).eq("accessStatus", "izin_verildi").eq("accessTime", latest.accessTime))
    .take(51);
  return visitorPresence(simultaneous.length > 50 ? [] : simultaneous.filter(row => row.projectId === visitor.projectId));
}

async function visitorListRow(ctx: QueryCtx, visitor: Doc<"employees">, now: number) {
  const [host, rule, presence, consent] = await Promise.all([
    visitor.hostEmployeeId ? ctx.db.get(visitor.hostEmployeeId) : null,
    visitor.accessRuleId ? ctx.db.get(visitor.accessRuleId) : null,
    latestVisitorPresence(ctx, visitor),
    activeKvkkConsentId(ctx, visitor._id),
  ]);
  return {
    _id: visitor._id,
    firstName: visitor.firstName,
    lastName: visitor.lastName,
    company: visitor.visitorCompany ?? null,
    cardNumber: maskedVisitorCard(visitor.cardNumber),
    hostName: host?.projectId === visitor.projectId && host ? `${host.firstName} ${host.lastName}` : null,
    presetRuleName: rule?.projectId === visitor.projectId && rule ? rule.name : null,
    visitStart: visitorTimeISO(visitor.accessStartsAt),
    visitEnd: visitorTimeISO(visitor.accessExpiresAt),
    status: visitorStatus(visitor, now),
    lastSeenAt: presence.lastReadingAt,
    lastDirection: presence.lastDirection,
    presence: presence.presence,
    hasKvkkConsent: consent !== null,
  };
}

/** Substring search and lifecycle filtering run before cursor pagination, across the project. */
export const listPage = authedQuery({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.union(v.literal("active"), v.literal("checkedOut"), v.literal("expired"), v.literal("preRegistered"))),
    search: v.optional(v.string()),
    now: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 100) {
      throw new Error("Sayfa boyutu 1–100 arasında olmalıdır");
    }
    const now = visitorQueryNow(args.now);
    // The generous window includes legacy TR wall-clock and offset ISO values;
    // exact instant comparison below removes the overlap before pagination.
    const upper = new Date(now + 14 * 60 * 60 * 1000).toISOString();
    const lower = new Date(now - 14 * 60 * 60 * 1000).toISOString();
    const source = stream(ctx.db, schema).query("employees");
    const indexed = args.status === "expired"
      ? mergedStream([
        source.withIndex("by_project_visitor_expiry", q => q.eq("projectId", args.projectId).eq("isVisitor", true).lte("accessExpiresAt", upper)).order("desc"),
        // A historically expired record can retain its status after extending its end date.
        source.withIndex("by_project_visitor_status_expiry", q => q.eq("projectId", args.projectId).eq("isVisitor", true).eq("visitorStatus", "expired").gt("accessExpiresAt", upper)).order("desc"),
      ], ["accessExpiresAt"])
      : args.status === "active"
        ? mergedStream([
          source.withIndex("by_project_visitor_expiry", q => q.eq("projectId", args.projectId).eq("isVisitor", true).gte("accessExpiresAt", lower)).order("desc"),
          // Legacy active visitors may have no expiry value.
          source.withIndex("by_project_visitor_expiry", q => q.eq("projectId", args.projectId).eq("isVisitor", true).eq("accessExpiresAt", undefined)).order("desc"),
        ], ["accessExpiresAt"])
        : source.withIndex("by_project_visitor", q => q.eq("projectId", args.projectId).eq("isVisitor", true)).order("desc");
    const result = await indexed
      .filterWith(async visitor => (!args.status || visitorStatus(visitor, now) === args.status) && visitorMatchesSearch(visitor, args.search))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map(visitor => visitorListRow(ctx, visitor, now))),
      searchScope: "project" as const,
      statusScope: "project" as const,
      evaluatedAt: new Date(now).toISOString(),
    };
  },
});

/** Counts share exactly the list's four lifecycle states; no per-visitor presence reads. */
export const summary = authedQuery({
  args: { projectId: v.id("projects"), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const now = visitorQueryNow(args.now);
    const counts = { active: 0, checkedOut: 0, expired: 0, preRegistered: 0 };
    let total = 0;
    let nextExpiry: number | null = null;
    const rows = ctx.db.query("employees")
      .withIndex("by_project_visitor", q => q.eq("projectId", args.projectId).eq("isVisitor", true));
    for await (const visitor of rows) {
      total++;
      const status = visitorStatus(visitor, now);
      counts[status]++;
      const expiry = visitorTime(visitor.accessExpiresAt);
      if (status !== "checkedOut" && status !== "expired" && expiry > now && (nextExpiry === null || expiry < nextExpiry)) nextExpiry = expiry;
    }
    return { total, counts, nextExpiry, evaluatedAt: new Date(now).toISOString() };
  },
});

export const getDetail = authedQuery({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.isVisitor !== true) return null;
    const allowed = await resolveProjectScope(ctx, visitor.projectId);
    if (!visitor.projectId || !allowed.includes(visitor.projectId)) throw new Error("Bu ziyaretçiye erişim yetkiniz yok");
    const [row, consent, accepted, denied, unknown] = await Promise.all([
      visitorListRow(ctx, visitor, Date.now()),
      activeKvkkConsentId(ctx, visitor._id),
      ctx.db.query("cardReadings").withIndex("by_employee_status_time", q => q.eq("employeeId", visitor._id).eq("accessStatus", "izin_verildi")).order("desc").take(10),
      ctx.db.query("cardReadings").withIndex("by_employee_status_time", q => q.eq("employeeId", visitor._id).eq("accessStatus", "reddedildi")).order("desc").take(10),
      ctx.db.query("cardReadings").withIndex("by_employee_status_time", q => q.eq("employeeId", visitor._id).eq("accessStatus", undefined)).order("desc").take(10),
    ]);
    return {
      ...row,
      projectId: visitor.projectId,
      ...visitorSensitiveFields(visitor, isManager(ctx.user)),
      cardReleased: visitor.cardNumber.startsWith("IADE:"),
      isActive: visitor.isActive ?? false,
      hostEmployeeId: visitor.hostEmployeeId ?? null,
      presetRuleId: visitor.accessRuleId ?? null,
      email: visitor.email?.toLowerCase().endsWith("@ngsaccess.local") ? null : visitor.email,
      visitorPhone: visitor.visitorPhone ?? null,
      visitorCompany: visitor.visitorCompany ?? null,
      visitPurpose: visitor.visitPurpose ?? null,
      notes: visitor.notes ?? null,
      kvkkConsent: consent ? { grantedAt: consent.grantedAt, documentUrl: consent.documentUrl ?? null, version: consent.documentVersion ?? null } : null,
      recentReadings: [...accepted, ...denied, ...unknown].filter(reading => reading.projectId === visitor.projectId)
        .sort((a, b) => b.accessTime.localeCompare(a.accessTime)).slice(0, 10)
        .map(reading => ({ _id: reading._id, accessTime: reading.accessTime, accessStatus: reading.accessStatus ?? null, direction: reading.direction ?? null, deviceId: reading.deviceId ?? null })),
    };
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
    kvkkDocumentVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    await validateVisitorAccessRelations(ctx, args.projectId, args.presetRuleId, args.hostEmployeeId);
    const inAllowed = (projectId: Id<"projects"> | undefined) => projectId === args.projectId;

    const validationError = visitorDetailsError(args, Date.now(), false) ?? visitorExpiryValidation(args.accessExpiresAt);
    if (validationError) throw new Error(validationError);
    const cardNumber = args.cardNumber.trim();
    if (!cardNumber) throw new Error("Kart numarası zorunludur");
    await validateVisitorPresetCard(ctx, args.projectId, args.presetRuleId, cardNumber);
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
      accessExpiresAt: new Date(visitorTime(args.accessExpiresAt)).toISOString(),
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
      await grantKvkkConsent(ctx, ctx.user, id, args.projectId, args.kvkkDocumentVersion);
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
    projectId: v.optional(v.id("projects")),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    cardNumber: v.optional(v.string()),
    presetRuleId: v.optional(v.id("accessRules")),
    accessExpiresAt: v.optional(v.string()),
    visitorPhone: v.optional(v.union(v.null(), v.string())),
    visitorCompany: v.optional(v.union(v.null(), v.string())),
    visitPurpose: v.optional(v.union(v.null(), v.string())),
    hostEmployeeId: v.optional(v.union(v.null(), v.id("employees"))),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.union(v.null(), v.string())),
    kvkkConsent: v.optional(v.boolean()),
    kvkkDocumentVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.isVisitor !== true) throw new Error("Ziyaretçi bulunamadı");
    assertAccessProjectUnchanged(visitor.projectId, args.projectId);
    await resolveProjectScope(ctx, visitor.projectId);
    const assigningPreset = args.presetRuleId !== undefined;
    // Only a ruleless mobile preregistration can receive its first operator
    // assignment. Existing visitor zone semantics remain unchanged.
    if (assigningPreset && !(visitor.mobileVisitorRequestId && visitor.isActive === false &&
        visitor.visitorStatus === "preRegistered" && visitor.cardNumber.startsWith("PRE:") && !visitor.accessRuleId)) {
      throw new Error("Ziyaretçi bölgesi yalnız mobil ön kayıt aktivasyonunda atanabilir");
    }
    await validateVisitorAccessRelations(ctx, visitor.projectId, args.presetRuleId ?? visitor.accessRuleId,
      args.hostEmployeeId === undefined ? visitor.hostEmployeeId : args.hostEmployeeId ?? undefined);

    const effective = { ...visitor, ...toPatch(args) };
    // İade edilmiş pasif kayıt kişisel bilgi düzenlemesine açık kalır.
    if (effective.isActive || args.cardNumber !== undefined || assigningPreset) {
      const validationError = visitorDetailsError(effective, Date.now(), false);
      if (validationError) throw new Error(validationError);
    }
    const expiryError = visitorUpdateExpiryError(visitor, args);
    if (expiryError) throw new Error(expiryError);
    if (args.firstName !== undefined && !args.firstName.trim()) throw new Error("Ad alanı zorunludur");
    if (args.lastName !== undefined && !args.lastName.trim()) throw new Error("Soyad alanı zorunludur");
    const newCard = args.cardNumber?.trim();
    const cardChanged = newCard !== undefined && newCard !== visitor.cardNumber;
    if (cardChanged) {
      if (!newCard) throw new Error("Kart numarası zorunludur");
      const dup = await findDuplicateEmployee(ctx, "cardNumber", newCard, args.visitorId);
      if (dup) throw new Error(DUPLICATE_MESSAGES.cardNumber);
    }
    if (cardChanged || args.isActive === true || assigningPreset) {
      await validateVisitorPresetCard(ctx, visitor.projectId, args.presetRuleId ?? visitor.accessRuleId,
        newCard ?? visitor.cardNumber, visitor._id);
    }
    const activeChanged = args.isActive !== undefined && args.isActive !== visitor.isActive;
    const deactivating = activeChanged && args.isActive === false;

    // IDE panellerini patch'ten ÖNCE çöz (capture-before-mutation): kart değişiminde ESKİ
    // kartı, deaktivasyonda paneldeki kartı FİZİKSEL sökmek için kullanılır. Deaktivasyonda
    // syncEmployeeToIdePanels YETMEZ — pasif kişiyi status=0 ile upsert eder, kart kaydı
    // panelde kalır. reconcileRemovedEmployeeIde de işe yaramaz: ziyaretçi kuralına bağlı
    // kaldığından remaining panel listesi boşalmaz (orphan üretmez) ve helper'ın trailing
    // syncEmployeeToIdePanels'ı kartı status=0 ile geri yazardı.
    let ideRemovalPanels: Id<"devices">[] = [];
    if (cardChanged || deactivating) {
      ideRemovalPanels = await resolveEmployeeIdeDeviceIds(ctx, args.visitorId, visitor.projectId);
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.firstName !== undefined) patch.firstName = args.firstName.trim();
    if (args.lastName !== undefined) patch.lastName = args.lastName.trim();
    if (args.visitorPhone !== undefined) patch.visitorPhone = toPatch({ visitorPhone: args.visitorPhone?.trim() || null }).visitorPhone;
    if (args.visitorCompany !== undefined) patch.visitorCompany = toPatch({ visitorCompany: args.visitorCompany?.trim() || null }).visitorCompany;
    if (args.visitPurpose !== undefined) patch.visitPurpose = toPatch({ visitPurpose: args.visitPurpose?.trim() || null }).visitPurpose;
    if (args.hostEmployeeId !== undefined) patch.hostEmployeeId = toPatch({ hostEmployeeId: args.hostEmployeeId }).hostEmployeeId;
    if (args.notes !== undefined) patch.notes = toPatch({ notes: args.notes?.trim() || null }).notes;
    if (args.accessExpiresAt !== undefined && args.accessExpiresAt !== visitor.accessExpiresAt) {
      patch.accessExpiresAt = new Date(visitorTime(args.accessExpiresAt)).toISOString();
    }
    if (cardChanged) patch.cardNumber = newCard;
    if (assigningPreset) patch.accessRuleId = args.presetRuleId;
    if (activeChanged) {
      patch.isActive = args.isActive;
      patch.visitorStatus = args.isActive ? "checkedIn" : "preRegistered";
    }
    await ctx.db.patch(args.visitorId, patch);
    if (assigningPreset) {
      await upsertGroupMembership(ctx, args.visitorId, args.presetRuleId, visitor.projectId);
    }

    // Kart değişiminde ESKİ kartı, deaktivasyonda paneldeki kartı IDE panellerinden FİZİKSEL
    // sök (orphan kalmasın). Paneller patch'ten önce çözüldü (ideRemovalPanels).
    if (ideRemovalPanels.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.ideGatewayDevice.deleteIdeUserFromPanels,
        { cardNumber: visitor.cardNumber, deviceIds: ideRemovalPanels, projectId: visitor.projectId },
      );
    }
    if (cardChanged || activeChanged) {
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
        employeeId: args.visitorId,
      });
    }
    // IDE push yalnız kart panelde AKTİF durmalıysa (kart değişimi → yeni kartı yaz, ya da
    // aktivasyon). Deaktivasyonda push YAPMA: yukarıdaki fiziksel sökmeyi status=0 upsert ile
    // geri alırdı.
    if ((cardChanged || activeChanged) && !deactivating) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.ideGatewayDevice.syncEmployeeToIdePanels,
        { employeeId: args.visitorId },
      );
    }
    if (args.kvkkConsent) {
      await grantKvkkConsent(ctx, ctx.user, args.visitorId, visitor.projectId, args.kvkkDocumentVersion);
    }
    return args.visitorId;
  },
  returns: v.id("employees"),
});

/** Manuel çıkış: erişimi geri al (isActive=false → cihazdan söker), durumu checkedOut yap. */
export const checkOut = adminMutation({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    const visitor = await requireEmployeeAccess(ctx, args.visitorId);
    if (visitor.isVisitor !== true) throw new Error("Ziyaretçi bulunamadı");
    if (visitor.isActive === false) return args.visitorId;
    // Deaktivasyondan ÖNCE bağlı IDE panellerini çöz; patch sonrası kartı FİZİKSEL sök.
    // syncEmployeeToIdePanels tek başına status=0 yazıp kart kaydını panelde bırakırdı.
    const idePanels = await resolveEmployeeIdeDeviceIds(ctx, args.visitorId, visitor.projectId);
    await ctx.db.patch(args.visitorId, {
      isActive: false,
      visitorStatus: "checkedOut",
      updatedAt: new Date().toISOString(),
    });
    await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
      employeeId: args.visitorId,
    });
    if (idePanels.length > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.actions.ideGatewayDevice.deleteIdeUserFromPanels,
        { cardNumber: visitor.cardNumber, deviceIds: idePanels, projectId: visitor.projectId },
      );
    }
    return args.visitorId;
  },
  returns: v.id("employees"),
});

/** Pasif ziyaretçinin kartını elle serbest bırak (rozet iadesi). Saf DB — cihaz işlemi yok. */
export const releaseCard = adminMutation({
  args: { visitorId: v.id("employees") },
  handler: async (ctx, args) => {
    const visitor = await requireEmployeeAccess(ctx, args.visitorId);
    if (visitor.isVisitor !== true) throw new Error("Ziyaretçi bulunamadı");
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
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    // Include legacy Istanbul wall-clock strings in the index window, then compare instants.
    const legacyUpperBound = new Date(nowMs + 3 * 60 * 60 * 1000).toISOString();
    const batch = await ctx.db
      .query("employees")
      .withIndex("by_visitor_active_expiry", (q) =>
        q.eq("isVisitor", true).eq("isActive", true).lte("accessExpiresAt", legacyUpperBound),
      )
      .paginate({ numItems: 50, cursor: args.cursor ?? null });
    const expired = batch.page.filter(visitor => visitorTime(visitor.accessExpiresAt) <= nowMs);
    for (const vz of expired) {
      // Deaktivasyondan ÖNCE IDE panellerini çöz; patch sonrası kartı FİZİKSEL sök
      // (status=0 upsert kart kaydını panelde bırakırdı).
      const idePanels = await resolveEmployeeIdeDeviceIds(ctx, vz._id, vz.projectId);
      await ctx.db.patch(vz._id, {
        isActive: false,
        visitorStatus: "expired",
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, {
        employeeId: vz._id,
      });
      if (idePanels.length > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.actions.ideGatewayDevice.deleteIdeUserFromPanels,
          { cardNumber: vz.cardNumber, deviceIds: idePanels, projectId: vz.projectId },
        );
      }
    }
    if (!batch.isDone) {
      await ctx.scheduler.runAfter(0, internal.visitors.expireVisitorAccess, { cursor: batch.continueCursor });
    }
    return { expired: expired.length };
  },
  returns: v.object({ expired: v.number() }),
});
