import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedQuery, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";

/**
 * Delete op'unun "kayıt zaten yok" yanıtı (idempotent). Yalnız markAck'in delete dalında
 * kullanılır — global isBenignSyncError'a EKLENMEZ, çünkü o Hik failed sayımını da etkiler ve
 * "not found"u tüm op tipleri için gizlerdi.
 */
function isAlreadyGoneError(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /not found|does ?n'?t exist|no such|not exist/i.test(raw);
}

/**
 * IDE Smart bulut→panel komut kuyruğu (idePendingOperations) yaşam döngüsü.
 *
 * Akış: action enqueueIdeOp → status "pending" → Hetzner bridge /ide-bridge/poll ile çeker
 * → /ide-bridge/sent (status "sent", msxId) → panel response → /ide-bridge/ack
 * (status "acked"/"failed" veya retry için "pending"). hikvisionSync queue deseninin
 * MQTT eşdeğeri; ama teslim Convex worker'ı değil, dış bridge tarafından yapılır.
 */

// ── Employee/AccessRule → IDE Smart record mapping (saf, docs §5.1/§5.2) ──

/** "HH:MM" → dakika (0–1439). Geçersizse null. */
export function hhmmToMinutes(hhmm: string | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** TR/EN gün adı → IDE week_day numarası (0=Sunday … 6=Saturday). Tanınmayan → null. */
const DAY_TO_IDE: Record<string, number> = {
  sunday: 0, pazar: 0,
  monday: 1, pazartesi: 1,
  tuesday: 2, sali: 2, salı: 2,
  wednesday: 3, carsamba: 3, çarşamba: 3,
  thursday: 4, persembe: 4, perşembe: 4,
  friday: 5, cuma: 5,
  saturday: 6, cumartesi: 6,
};
export function daysToIdeWeekDays(days: string[] | undefined): number[] {
  if (!days || days.length === 0) return [0, 1, 2, 3, 4, 5, 6]; // boş → 7 gün açık (Hik deseni)
  const out = new Set<number>();
  for (const d of days) {
    const n = DAY_TO_IDE[d.trim().toLowerCase()];
    if (n !== undefined) out.add(n);
  }
  return Array.from(out).sort((a, b) => a - b);
}

export interface IdePermissionRecordShape {
  id: number;
  io: number[];
  schedule: { start: number; end: number; week_days: number[] };
}

/** IDE permission.io: aktüatör index 0–7, max 8 öğe (docs §5.2). */
const MAX_IO_PER_PERMISSION = 8;
/** IDE user.permissions: max 16 referans (AC.MAX_PERMS_PER_USER, docs §5.1). */
export const MAX_PERMS_PER_USER = 16;

/** accessRule + panelin io listesi → IDE permission record. io 0–7'ye filtrelenir, 8'e kırpılır. */
export function buildIdePermissionRecord(
  idePermissionNo: number,
  ioIds: number[],
  rule: { startTime?: string; endTime?: string; days?: string[] },
): IdePermissionRecordShape {
  const start = hhmmToMinutes(rule.startTime) ?? 0;
  const end = hhmmToMinutes(rule.endTime) ?? 1439;
  const io = ioIds
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 7)
    .slice(0, MAX_IO_PER_PERMISSION);
  return {
    id: idePermissionNo,
    io: io.length > 0 ? io : [0],
    schedule: { start, end, week_days: daysToIdeWeekDays(rule.days) },
  };
}

/**
 * user.permissions[] için: geçersizleri (n<1) ele, tekilleştir, sırala, panel üst
 * sınırına (16) kırp. Bir çalışan aynı panele birden çok kuralla bağlıysa tüm
 * permNo'ları toplanır; bu fonksiyon kaybı/yinelemeyi önler.
 */
export function capPermissionNos(
  permNos: number[],
  max: number = MAX_PERMS_PER_USER,
): number[] {
  const unique = Array.from(
    new Set(permNos.filter((n) => Number.isInteger(n) && n >= 1)),
  );
  unique.sort((a, b) => a - b);
  return unique.slice(0, max);
}

/**
 * buildIdePermissionRecord'un sessizce eleyeceği (0–7 dışı) ioId'ler. Çağıran action
 * bunları görünür kılmak (skipped/uyarı) için kullanır — yanlış yapılandırılmış
 * doors.ioId yüzünden bir kapının erişim kaybetmesi fark edilmeden geçmesin.
 */
export function outOfRangeIoIds(ioIds: number[]): number[] {
  return ioIds.filter((n) => !(Number.isInteger(n) && n >= 0 && n <= 7));
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_ACK_TIMEOUT_MS = 90_000;
/** Retry backoff: attempt sayısına göre artan gecikme (ms). */
function backoffMs(attempts: number): number {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempts - 1));
}

// ── idePanelUsers (panel roster yansıması) yardımcıları ──────────────

/**
 * Kart no'yu panel kimliğine normalize eder: panel user.id sayısaldır, employees.cardNumber
 * ise "0008219041" gibi baştan sıfırlı olabilir. String(Number(x)) ile iki taraf eşitlenir
 * ("0008219041" → "8219041"). Geçersiz/≤0 ise null (panele yazılmaz).
 */
export function normalizeIdeCard(raw: unknown): string | null {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return String(n);
}

/** Panel roster'a kart ekle/güncelle (ideUuid+card tekil). */
async function upsertPanelUser(
  ctx: MutationCtx,
  ideUuid: string,
  deviceId: Id<"devices">,
  card: string,
  projectId: Id<"projects"> | undefined,
): Promise<void> {
  const existing = await ctx.db
    .query("idePanelUsers")
    .withIndex("by_uuid_card", (q) => q.eq("ideUuid", ideUuid).eq("cardNumber", card))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { deviceId, projectId, syncedAt: Date.now() });
  } else {
    await ctx.db.insert("idePanelUsers", {
      ideUuid,
      deviceId,
      cardNumber: card,
      projectId,
      syncedAt: Date.now(),
    });
  }
}

/** Panel roster'dan kartı çıkar (deleteUser ack'lendiğinde). */
async function removePanelUser(
  ctx: MutationCtx,
  ideUuid: string,
  card: string,
): Promise<void> {
  const existing = await ctx.db
    .query("idePanelUsers")
    .withIndex("by_uuid_card", (q) => q.eq("ideUuid", ideUuid).eq("cardNumber", card))
    .first();
  if (existing) await ctx.db.delete(existing._id);
}

export type IdeOpType = Doc<"idePendingOperations">["opType"];

/** opType'a göre op'un hedef varlığını tanımlayan idempotency parçası. */
function targetKey(opType: IdeOpType, payload: Record<string, unknown>): string {
  switch (opType) {
    case "openDoor":
      // Kapı açma idempotent DEĞİL — her istek ayrı (timestamp ekle, dedupe etme).
      return `door:${String(payload.ioId)}:${Date.now()}`;
    case "upsertUser":
    case "deleteUser": {
      const rec = payload.userRecord as { id?: unknown } | undefined;
      const id = payload.ideUserId ?? rec?.id;
      return `user:${String(id)}`;
    }
    case "upsertPermission":
    case "deletePermission": {
      const rec = payload.permissionRecord as { id?: unknown } | undefined;
      const id = payload.ideId ?? rec?.id;
      return `perm:${String(id)}`;
    }
    case "triggerSync":
      return "sync";
    case "parameterWrite":
      // Aynı parametre için tek pending — en son yazım kazanır.
      return `param:${String(payload.parameterName)}`;
    default:
      return "unknown";
  }
}

/**
 * Komut kuyruğa ekler (idempotent). Aynı deviceId+opType+hedef için pending/sent op
 * varsa yeni insert atmaz — mevcut op'u payload ile günceller (en son içerik kazanır).
 */
export const enqueueIdeOp = internalMutation({
  args: {
    deviceId: v.id("devices"),
    projectId: v.optional(v.id("projects")),
    opType: v.union(
      v.literal("openDoor"),
      v.literal("upsertUser"),
      v.literal("deleteUser"),
      v.literal("upsertPermission"),
      v.literal("deletePermission"),
      v.literal("triggerSync"),
      v.literal("parameterWrite"),
    ),
    payload: v.any(),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"idePendingOperations">> => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.brand !== "ide_smart") {
      throw new Error("IDE sync kuyruğuna sadece IDE Smart panel işleri yazılabilir");
    }

    const payload = (args.payload ?? {}) as Record<string, unknown>;
    const idempotencyKey = `${args.deviceId}:${args.opType}:${targetKey(args.opType, payload)}`;
    const now = Date.now();

    // openDoor dışı op'lar için açık pending/sent dedupe.
    if (args.opType !== "openDoor") {
      const existing = await ctx.db
        .query("idePendingOperations")
        .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idempotencyKey))
        .collect();
      const open = existing.find((o) => o.status === "pending" || o.status === "sent");
      if (open) {
        await ctx.db.patch(open._id, {
          payload: args.payload,
          status: "pending",
          msxId: undefined,
          nextRetryAt: now,
          lastError: undefined,
        });
        return open._id;
      }
    }

    return await ctx.db.insert("idePendingOperations", {
      projectId: args.projectId,
      deviceId: args.deviceId,
      opType: args.opType,
      payload: args.payload,
      status: "pending",
      idempotencyKey,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: now,
      createdAt: now,
    });
  },
});

/** Bridge'in çekeceği pending op'lar (nextRetryAt geçmiş). materialize edilmiş alanlarla. */
export const listPendingForBridge = internalQuery({
  args: { max: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = Math.min(args.max ?? 10, 50);
    const candidates = await ctx.db
      .query("idePendingOperations")
      .withIndex("by_status_nextRetry", (q) =>
        q.eq("status", "pending").lte("nextRetryAt", now),
      )
      .take(limit);

    const ops = [];
    for (const op of candidates) {
      const device = await ctx.db.get(op.deviceId);
      if (!device || device.brand !== "ide_smart" || !device.ideUuid) continue;
      const payload = (op.payload ?? {}) as Record<string, unknown>;
      // Level-1 komutlar (create_data/delete_data/sync) panelde login token'ı ister;
      // openDoor (update_actuator keep=1) level 0'dır. Bridge token'ı MQTT login ile alır,
      // bunun için panel kimlik bilgisini buradan iletiyoruz (openDoor'a göndermeyiz).
      const needsAuth = op.opType !== "openDoor";
      ops.push({
        opId: op._id,
        opType: op.opType,
        dstId: device.ideUuid,
        ...(needsAuth
          ? { ideUser: device.ideUser, idePassword: device.idePassword }
          : {}),
        ...payload,
      });
    }
    return { ops };
  },
});

/** Bridge "sent" bildirdi: msxId yaz, ack bekle. */
export const markSent = internalMutation({
  args: { opId: v.id("idePendingOperations"), msxId: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const op = await ctx.db.get(args.opId);
    if (!op || op.status !== "pending") return;
    await ctx.db.patch(args.opId, {
      status: "sent",
      msxId: args.msxId,
      sentAt: Date.now(),
      attempts: op.attempts + 1,
    });
  },
});

/**
 * idePanelUsers'ı panelden okunan gerçek roster'la doldurur (tek seferlik seed / yeniden eşitleme).
 * `rawCards` panelin döndürdüğü user.id listesi (LAN'dan get_data sayfalama ile okunur). Tablo
 * yeni özellikten önce var olan hayalet kartları içermediğinden, mevcut paneller için bir kez
 * çalıştırılır → sonraki "Güncelle"de reconcilePanelRosterIde fazlalıkları söker.
 */
export const seedPanelUsers = internalMutation({
  args: { deviceId: v.id("devices"), rawCards: v.array(v.union(v.number(), v.string())) },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const device = await ctx.db.get(args.deviceId);
    if (!device?.ideUuid) return 0;
    let n = 0;
    for (const raw of args.rawCards) {
      const card = normalizeIdeCard(raw);
      if (!card) continue;
      await upsertPanelUser(ctx, device.ideUuid, args.deviceId, card, device.projectId);
      n++;
    }
    return n;
  },
});

/** Bridge ack/timeout bildirdi: result'a göre terminal veya retry. */
export const markAck = internalMutation({
  args: {
    opId: v.id("idePendingOperations"),
    msxId: v.optional(v.number()),
    result: v.union(v.literal("success"), v.literal("fail"), v.literal("timeout")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const op = await ctx.db.get(args.opId);
    if (!op) return;
    // Yalnızca "sent" (panele iletilmiş, ack bekleyen) op ack'lenebilir. pending/acked/
    // failed op'a gelen ack reddedilir — aksi halde panele HİÇ gitmemiş bir komut
    // (henüz pending) sahte/erken success ile "acked" sayılabilirdi.
    if (op.status !== "sent") return;
    // Eski/yinelenen ack'i ele: beklenen msxId ile eşleşmeli (markSent her zaman msxId yazar).
    if (args.msxId != null && op.msxId != null && op.msxId !== args.msxId) return;

    if (args.result === "success") {
      await ctx.db.patch(args.opId, {
        status: "acked",
        ackedAt: Date.now(),
        responseMessage: args.message,
        lastError: undefined,
      });
      // Panel roster yansımasını güncelle (idePanelUsers): upsertUser → kart panelde,
      // deleteUser → panelden gitti. reconcilePanelRosterIde bu tabloyla "panelde olan −
      // yetkili" farkını hesaplar. ideUuid bazlı (re-claim'e dayanıklı).
      if (op.opType === "upsertUser" || op.opType === "deleteUser") {
        const device = await ctx.db.get(op.deviceId);
        if (device?.ideUuid) {
          const payload = (op.payload ?? {}) as Record<string, unknown>;
          const rawId =
            op.opType === "upsertUser"
              ? (payload.userRecord as { id?: unknown } | undefined)?.id
              : payload.ideUserId;
          const card = normalizeIdeCard(rawId);
          if (card) {
            if (op.opType === "upsertUser") {
              await upsertPanelUser(ctx, device.ideUuid, op.deviceId, card, op.projectId);
            } else {
              await removePanelUser(ctx, device.ideUuid, card);
            }
          }
        }
      }
      return;
    }
    // "already exists": create_data var olan kayıtta reddedildi (panel create≠update).
    // Op'u mode:"update"'e çevirip HEMEN yeniden kuyruğa al → bridge update_data gönderir
    // (envelopeForOp mode'a bakar). Tek seferlik dönüşüm: mode zaten "update" ise döngü yok.
    // update_data partial-patch (docs §4.5.3) ama tam record gönderdiğimiz için istenen
    // alanlar (status/permissions, io/schedule) üzerine yazılır.
    if (
      args.result === "fail" &&
      (op.opType === "upsertUser" || op.opType === "upsertPermission") &&
      /already exists/i.test(args.message ?? "")
    ) {
      const payload = (op.payload ?? {}) as Record<string, unknown>;
      if (payload.mode !== "update") {
        await ctx.db.patch(args.opId, {
          payload: { ...payload, mode: "update" },
          status: "pending",
          msxId: undefined,
          nextRetryAt: Date.now(),
          lastError: "already exists → update_data ile yeniden denenecek",
        });
        return;
      }
    }
    // deleteUser/deletePermission "not found" → kayıt zaten yok; istenen son durum (kayıt yok)
    // sağlanmış → idempotent terminal başarı. deleteUser ise roster yansımasından da düş; aksi
    // halde idePanelUsers satırı kalır ve her Güncelle yeni (yine başarısız) deleteUser üretirdi.
    if (
      args.result === "fail" &&
      (op.opType === "deleteUser" || op.opType === "deletePermission") &&
      isAlreadyGoneError(args.message)
    ) {
      await ctx.db.patch(args.opId, {
        status: "acked",
        ackedAt: Date.now(),
        responseMessage: args.message,
        lastError: undefined,
      });
      if (op.opType === "deleteUser") {
        const device = await ctx.db.get(op.deviceId);
        const card = normalizeIdeCard(
          ((op.payload ?? {}) as Record<string, unknown>).ideUserId,
        );
        if (device?.ideUuid && card) await removePanelUser(ctx, device.ideUuid, card);
      }
      return;
    }
    // fail / timeout → retry veya terminal failed
    const maxAttempts = op.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    if (op.attempts >= maxAttempts) {
      await ctx.db.patch(args.opId, {
        status: "failed",
        lastError: args.message ?? args.result,
      });
    } else {
      await ctx.db.patch(args.opId, {
        status: "pending",
        msxId: undefined,
        nextRetryAt: Date.now() + backoffMs(op.attempts),
        lastError: args.message ?? args.result,
      });
    }
  },
});

/**
 * "sent"te asılı kalan op'ları (panel ack atmadı) geri pending'e al.
 * cron'dan çağrılır — bridge timeout ack'i kaçırırsa güvenlik ağı.
 */
export const requeueTimedOut = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const now = Date.now();
    // "sent" op'larda nextRetryAt set olmaz → by_status_nextRetry'da status eşitliğiyle tara.
    const stuck = await ctx.db
      .query("idePendingOperations")
      .withIndex("by_status_nextRetry", (q) => q.eq("status", "sent"))
      .collect();
    let n = 0;
    for (const op of stuck) {
      const timeout = DEFAULT_ACK_TIMEOUT_MS;
      if (op.sentAt && op.sentAt + timeout < now) {
        const maxAttempts = op.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        if (op.attempts >= maxAttempts) {
          await ctx.db.patch(op._id, { status: "failed", lastError: "ack timeout (cron)" });
        } else {
          await ctx.db.patch(op._id, {
            status: "pending",
            msxId: undefined,
            nextRetryAt: now,
            lastError: "ack timeout (cron)",
          });
        }
        n++;
      }
    }
    return n;
  },
});

// ── Permission no atama (idePermissionNo; hikWeekPlanNo analogu) ────

/**
 * Kurala idePermissionNo ata ve döndür — ATOMİK (read+write tek mutation).
 * Zaten varsa mevcut no döner; yoksa (max+1) atanıp döner. Tek mutation olduğu için
 * iki eşzamanlı sync'in aynı no'yu atamasına yol açan read-modify-write yarışını kapatır
 * (getMaxIdePermissionNo + ayrı assign çağrısı yerine).
 */
export const ensureIdePermissionNo = internalMutation({
  args: { accessRuleId: v.id("accessRules") },
  handler: async (ctx, args): Promise<number> => {
    const rule = await ctx.db.get(args.accessRuleId);
    if (rule && typeof rule.idePermissionNo === "number") return rule.idePermissionNo;
    const rules = await ctx.db.query("accessRules").collect();
    let max = 0;
    for (const r of rules) {
      if (typeof r.idePermissionNo === "number" && r.idePermissionNo > max) max = r.idePermissionNo;
    }
    const next = max + 1;
    await ctx.db.patch(args.accessRuleId, { idePermissionNo: next });
    return next;
  },
});

/**
 * Bir kural + panel için IDE permission.io listesi.
 * Kuralın bu panele ait seçili kapıları (groupDoors) varsa onların ioId'leri;
 * hiç yoksa panelin tüm kapıları (geriye uyumlu — eski kurallar bozulmaz).
 */
export const getRuleIoIdsForPanel = internalQuery({
  args: { ruleId: v.id("accessRules"), deviceId: v.id("devices") },
  handler: async (ctx, args): Promise<number[]> => {
    const groupDoors = await ctx.db
      .query("groupDoors")
      .withIndex("by_group", (q) => q.eq("groupId", args.ruleId))
      .collect();
    const ioIds = new Set<number>();
    for (const gd of groupDoors) {
      const door = await ctx.db.get(gd.doorId);
      if (!door || door.deviceId !== args.deviceId) continue;
      if (typeof door.ioId === "number") ioIds.add(door.ioId);
    }
    if (ioIds.size > 0) return Array.from(ioIds).sort((a, b) => a - b);

    // Fallback: kuralın bu panel için kapı seçimi yok → panelin tüm kapıları.
    const doors = await ctx.db
      .query("doors")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
    for (const d of doors) {
      if (typeof d.ioId === "number") ioIds.add(d.ioId);
    }
    return Array.from(ioIds).sort((a, b) => a - b);
  },
});

/** UI: çözülmemiş IDE komut sorunları (failed op'lar). RBAC: kullanıcının projeleri. */
export const listSyncIssues = authedQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const max = args.limit ?? 50;
    const failed = await ctx.db
      .query("idePendingOperations")
      .withIndex("by_status_nextRetry", (q) => q.eq("status", "failed"))
      .take(max * 4);

    const visible = failed.filter((o) => isProjectAllowed(allowedProjectIds, o.projectId));
    const deviceIds = Array.from(new Set(visible.map((o) => o.deviceId)));
    const devices = await Promise.all(deviceIds.map((id) => ctx.db.get(id)));
    const deviceMap = new Map(
      devices.filter((d): d is NonNullable<typeof d> => d !== null).map((d) => [d._id, d]),
    );

    return visible.slice(0, max).map((o) => ({
      _id: o._id,
      deviceId: o.deviceId,
      deviceName: deviceMap.get(o.deviceId)?.name ?? "(bilinmeyen cihaz)",
      opType: o.opType,
      attempts: o.attempts,
      lastError: o.lastError ?? null,
      createdAt: o.createdAt,
    }));
  },
});

/** Verilen op'ların güncel durumu — UI-tetikli sync action'ın ack bekleme poll'u için. */
export const getOpStatuses = internalQuery({
  args: { opIds: v.array(v.id("idePendingOperations")) },
  handler: async (ctx, args) => {
    const ops = await Promise.all(args.opIds.map((id) => ctx.db.get(id)));
    return ops
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .map((o) => ({
        _id: o._id,
        status: o.status,
        opType: o.opType,
        deviceId: o.deviceId,
        lastError: o.lastError ?? null,
        responseMessage: o.responseMessage ?? null,
      }));
  },
});

/** UI: tek bir başarısız (terminal) IDE op'unu sil — banner'dan kapat. RBAC: kullanıcının projeleri. */
export const dismissSyncIssue = authedMutation({
  args: { opId: v.id("idePendingOperations") },
  handler: async (ctx, args): Promise<void> => {
    const allowed = await getProjectIdsForUser(ctx);
    const op = await ctx.db.get(args.opId);
    // Sadece terminal "failed" op silinir — pending/sent (uçuşta) op'a dokunma.
    if (!op || op.status !== "failed") return;
    if (!isProjectAllowed(allowed, op.projectId)) return;
    await ctx.db.delete(args.opId);
  },
});

/** UI: kullanıcının projelerindeki tüm başarısız IDE op'larını sil. Silinen sayısını döner. */
export const dismissAllSyncIssues = authedMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const allowed = await getProjectIdsForUser(ctx);
    const failed = await ctx.db
      .query("idePendingOperations")
      .withIndex("by_status_nextRetry", (q) => q.eq("status", "failed"))
      .collect();
    let n = 0;
    for (const op of failed) {
      if (!isProjectAllowed(allowed, op.projectId)) continue;
      await ctx.db.delete(op._id);
      n++;
    }
    return n;
  },
});
