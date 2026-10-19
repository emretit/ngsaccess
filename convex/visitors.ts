import { canSeePay, maskPay } from "./lib/payVisibility";
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
import { getProjectIdsForUser, isManager } from "./lib/auth";
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
    const allowed = await resolveProjectScope(ctx, args.projectId);
    const rules = (await Promise.all(allowed.map(projectId =>
      ctx.db.query("accessRules").withIndex("by_project", q => q.eq("projectId", projectId)).collect(),
    ))).flat();

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
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowed = await resolveProjectScope(ctx, args.projectId);
    const visitors = (await Promise.all(allowed.map(projectId =>
      ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", projectId).eq("isVisitor", true)).order("desc").collect(),
    ))).flat();

    return await Promise.all(
      visitors.map(async (vz) => {
        const host = vz.hostEmployeeId ? await ctx.db.get(vz.hostEmployeeId) : null;
        const rule = vz.accessRuleId ? await ctx.db.get(vz.accessRuleId) : null;
        // Son kabul edilen olay; retler konumu değiştirmez, eksik yön bilinmiyor kalır.
        const latest = await ctx.db.query("cardReadings")
          .withIndex("by_employee_status_time", q => q.eq("employeeId", vz._id).eq("accessStatus", "izin_verildi"))
          .order("desc").first();
        // Aynı andaki çelişkili yönler bilinmiyor olarak kalır.
        const readings = latest?.projectId === vz.projectId && latest ? await ctx.db.query("cardReadings")
          .withIndex("by_employee_status_time", q => q.eq("employeeId", vz._id).eq("accessStatus", "izin_verildi").eq("accessTime", latest.accessTime))
          .collect() : [];
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
          hourlyRate: maskPay(vz.hourlyRate, canSeePay(ctx.user)),
          monthlySalary: maskPay(vz.monthlySalary, canSeePay(ctx.user)),
          status: visitorStatus(vz),
          host: host?.projectId === vz.projectId && host
            ? { _id: host._id, firstName: host.firstName, lastName: host.lastName }
            : null,
          presetRule: rule?.projectId === vz.projectId && rule ? { _id: rule._id, name: rule.name } : null,
          ...visitorPresence(readings.filter(reading => reading.projectId === vz.projectId)),
          hasKvkkConsent: !!activeConsent,
          kvkkConsentAt: activeConsent?.grantedAt ?? null,
        };
      }),
    );
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

/** Cursor ham proje kayıtlarında ilerler; boş süzülmüş sayfa son sayfa anlamına gelmez. */
export const listPage = authedQuery({
  args: {
    projectId: v.id("projects"),
    status: v.optional(v.union(v.literal("active"), v.literal("checkedOut"), v.literal("expired"), v.literal("preRegistered"), v.literal("inactive"))),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    // İstemci dakika değişiminde yeniler; zaman hesabı yine sunucu Date.now() ile yapılır.
    refreshKey: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 100) {
      throw new Error("Sayfa boyutu 1–100 arasında olmalıdır");
    }
    const now = Date.now();
    const result = await ctx.db.query("employees")
      .withIndex("by_project_visitor", q => q.eq("projectId", args.projectId).eq("isVisitor", true))
      .order("desc").paginate(args.paginationOpts);
    const matches = result.page.filter(visitor => (!args.status || visitorStatus(visitor, now) === args.status) && visitorMatchesSearch(visitor, args.search));
    return {
      ...result,
      page: await Promise.all(matches.map(visitor => visitorListRow(ctx, visitor, now))),
      searchScope: "page" as const,
      statusScope: "page" as const,
      scannedCount: result.page.length,
      evaluatedAt: new Date(now).toISOString(),
    };
  },
});

/** Özet liste/filtrelerden bağımsızdır; kesilen toplamlar yalnız taranan alt kümeyi temsil eder. */
export const summary = authedQuery({
  args: { projectId: v.id("projects"), refreshKey: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    const scanLimit = 500;
    const rows = await ctx.db.query("employees")
      .withIndex("by_project_visitor", q => q.eq("projectId", args.projectId).eq("isVisitor", true))
      .order("desc").take(scanLimit + 1);
    const visitors = rows.slice(0, scanLimit);
    const now = Date.now();
    const counts = { active: 0, checkedOut: 0, expired: 0, preRegistered: 0, inactive: 0 };
    for (const visitor of visitors) counts[visitorStatus(visitor, now)]++;
    const presences = await Promise.all(visitors.map(visitor => latestVisitorPresence(ctx, visitor)));
    return {
      total: visitors.length,
      counts,
      accessActive: counts.active,
      accessClosed: visitors.length - counts.active,
      inside: presences.filter(presence => presence.presence === "inside").length,
      truncated: rows.length > scanLimit,
      scanLimit,
      evaluatedAt: new Date(now).toISOString(),
    };
  },
});

export const getDetail = authedQuery({
  args: { visitorId: v.id("employees"), refreshKey: v.optional(v.number()) },
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
      email: visitor.email,
      visitorPhone: visitor.visitorPhone ?? null,
      visitorCompany: visitor.visitorCompany ?? null,
      visitPurpose: visitor.visitPurpose ?? null,
      notes: visitor.notes ?? null,
      kvkkConsent: consent ? { grantedAt: consent.grantedAt, documentUrl: consent.documentUrl ?? null, version: null } : null,
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
  },
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    await validateVisitorAccessRelations(ctx, args.projectId, args.presetRuleId, args.hostEmployeeId);
    const inAllowed = (projectId: Id<"projects"> | undefined) => projectId === args.projectId;

    const validationError = visitorDetailsError(args, Date.now(), false) ?? visitorExpiryValidation(args.accessExpiresAt);
    if (validationError) throw new Error(validationError);
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
    projectId: v.optional(v.id("projects")),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    cardNumber: v.optional(v.string()),
    accessExpiresAt: v.optional(v.string()),
    visitorPhone: v.optional(v.union(v.null(), v.string())),
    visitorCompany: v.optional(v.union(v.null(), v.string())),
    visitPurpose: v.optional(v.union(v.null(), v.string())),
    hostEmployeeId: v.optional(v.union(v.null(), v.id("employees"))),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.union(v.null(), v.string())),
    kvkkConsent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.isVisitor !== true) throw new Error("Ziyaretçi bulunamadı");
    assertAccessProjectUnchanged(visitor.projectId, args.projectId);
    await resolveProjectScope(ctx, visitor.projectId);
    await validateVisitorAccessRelations(ctx, visitor.projectId, visitor.accessRuleId,
      args.hostEmployeeId === undefined ? visitor.hostEmployeeId : args.hostEmployeeId ?? undefined);

    const effective = { ...visitor, ...toPatch(args) };
    // İade edilmiş pasif kayıt kişisel bilgi düzenlemesine açık kalır.
    if (effective.isActive || args.cardNumber !== undefined) {
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
    if (activeChanged) {
      patch.isActive = args.isActive;
      patch.visitorStatus = args.isActive ? "checkedIn" : "preRegistered";
    }
    await ctx.db.patch(args.visitorId, patch);

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
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    // Include legacy Istanbul wall-clock strings in the index window, then compare instants.
    const legacyUpperBound = new Date(nowMs + 3 * 60 * 60 * 1000).toISOString();
    const candidates = await ctx.db
      .query("employees")
      .withIndex("by_visitor_active_expiry", (q) =>
        q.eq("isVisitor", true).eq("isActive", true).lte("accessExpiresAt", legacyUpperBound),
      )
      .collect();
    const expired = candidates.filter(visitor => visitorTime(visitor.accessExpiresAt) <= nowMs);
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
    return { expired: expired.length };
  },
  returns: v.object({ expired: v.number() }),
});
