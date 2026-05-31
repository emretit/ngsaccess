"use node";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import { authedAction } from "../lib/customFunctions";
import { isProjectAllowed } from "../lib/auth";
import type { Id } from "../_generated/dataModel";
import { buildIdePermissionRecord, capPermissionNos, outOfRangeIoIds } from "../ideSync";

/**
 * IDE Smart panel action'ları.
 * Komutlar MQTT üzerinden iletilir: Convex `idePendingOperations` kuyruğu → Hetzner
 * bridge → broker → panel. Panel broker'a kendi bağlanır (LAN'da); Convex panele
 * doğrudan HTTP ile bağlanmaz. (HTTP/LAN modu kaldırıldı — bkz docs/ide-smart.)
 */

interface IdeDevice {
  _id: Id<"devices">;
  name: string;
  projectId?: Id<"projects">;
  brand?: string;
  ideUuid?: string;
}

/** Yetki + brand doğrulayıp paneli döner. */
async function loadIdePanel(
  ctx: GenericActionCtx<DataModel>,
  deviceId: Id<"devices">,
): Promise<{ device: IdeDevice } | { error: string }> {
  const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
    internal.users.listProjectIdsForCurrentUser,
    {},
  );
  const device = (await ctx.runQuery(internal.devices.getByIdInternal, {
    id: deviceId,
  })) as IdeDevice | null;
  if (!device) return { error: "Cihaz bulunamadı" };
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    return { error: "Bu cihaza erişim yetkiniz yok" };
  }
  if (device.brand !== "ide_smart") {
    return { error: "Cihaz bir IDE Smart paneli değil" };
  }
  return { device };
}

/**
 * Kapıyı aç/kapat: door → ioId çöz, MQTT kuyruğuna openDoor op'u yaz.
 *
 * keep semantiği (docs §4.4.1):
 *   1 (default) = admin latch ON  — access-control gate'i bypass eder, user_id gerekmez.
 *   0           = latch release.
 * Pulse modu (value:1) admin tarafından user_id gerektirdiği için kullanılmaz;
 * manuel "Kapıyı Aç" admin latch'tir.
 */
/**
 * Çalışanı bağlı olduğu IDE Smart panellerine yaz (MQTT kuyruğu).
 * Employee → IdeUserRecord: id=cardNumber(numeric), status=isActive?1:0, permissions=[...permNo].
 *
 * Panel başına gruplama: bir çalışan aynı panele birden çok kuralla bağlı olabilir
 * (örn. iki kapı grubu) → user.permissions[] TÜM kuralların permNo'sunu içerir.
 * Her panel için ÖNCE ilgili permission RECORD'larını (upsertPermission) enqueue eder,
 * SONRA upsertUser gönderir; böylece user.permissions referansının panelde karşılığı
 * bulunur (docs §9.1: kayıt yoksa "User is not permitted").
 *
 * Scheduler'dan/UI mutation'larından tetiklendiği için internalAction (authedAction
 * scheduler context'inde auth identity olmadığından throw ederdi). Yetki, tetikleyen
 * mutation'da (adminMutation) zaten denetlenmiştir.
 */
export const syncEmployeeToIdePanels = internalAction({
  args: { employeeId: v.id("employees") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    queued: number;
    skipped: string[];
    opIds: Id<"idePendingOperations">[];
    error?: string;
  }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data) return { ok: false, queued: 0, skipped: [], opIds: [], error: "Çalışan bulunamadı" };

    // IDE paneline bağlı (kural×cihaz) çiftleri. Hiç yoksa sessiz no-op: Hikvision-only
    // kurulumda her employee mutation'ı boşa IDE push tetiklemesin.
    const ideRules = data.deviceRules.filter((dr) => dr.device.brand === "ide_smart");
    if (ideRules.length === 0) return { ok: true, queued: 0, skipped: [], opIds: [] };

    // Kart no doğrulaması yalnızca gerçekten IDE paneli VARSA anlamlı.
    const cardNo = Number(data.employee.cardNumber);
    if (!Number.isSafeInteger(cardNo) || cardNo < 1) {
      return {
        ok: false,
        queued: 0,
        skipped: [],
        opIds: [],
        error: `Kart numarası IDE için sayısal olmalı (${data.employee.cardNumber})`,
      };
    }
    const status: 0 | 1 = data.employee.isActive === false ? 0 : 1;

    // Panel başına grupla: aynı panele bağlı tüm kuralları topla.
    type IdeRule = (typeof ideRules)[number];
    const byPanel = new Map<Id<"devices">, IdeRule[]>();
    for (const dr of ideRules) {
      const list = byPanel.get(dr.device._id) ?? [];
      list.push(dr);
      byPanel.set(dr.device._id, list);
    }

    const skipped: string[] = [];
    const opIds: Id<"idePendingOperations">[] = [];
    let queued = 0;

    for (const [deviceId, rules] of byPanel) {
      const panel = await ctx.runQuery(internal.devices.getByIdInternal, { id: deviceId });
      if (!panel || !panel.ideUuid) {
        skipped.push(`${rules[0].device.name}: panel UUID yok`);
        continue;
      }
      const ioIds = await ctx.runQuery(internal.ideSync.getIdePanelIoIds, { deviceId });
      const droppedIo = outOfRangeIoIds(ioIds);
      if (droppedIo.length > 0) {
        skipped.push(`${panel.name}: spec-dışı io ${droppedIo.join(",")} atlandı (0–7 beklenir)`);
      }

      // Önce her kuralın permission RECORD'unu panele yaz (upsertUser'dan ÖNCE).
      const permNos: number[] = [];
      for (const dr of rules) {
        const permNo = await ctx.runMutation(internal.ideSync.ensureIdePermissionNo, {
          accessRuleId: dr.rule._id,
        });
        const permissionRecord = buildIdePermissionRecord(permNo, ioIds, {
          startTime: dr.rule.startTime,
          endTime: dr.rule.endTime,
          days: dr.rule.days,
        });
        const permOpId = await ctx.runMutation(internal.ideSync.enqueueIdeOp, {
          deviceId,
          projectId: panel.projectId,
          opType: "upsertPermission",
          payload: { mode: "create", permissionRecord },
        });
        opIds.push(permOpId);
        queued++;
        permNos.push(permNo);
      }

      const uniqueCount = new Set(permNos).size;
      const permissions = capPermissionNos(permNos);
      if (uniqueCount > permissions.length) {
        skipped.push(
          `${panel.name}: ${uniqueCount} izin panel sınırına (${permissions.length}) kırpıldı`,
        );
      }

      const userOpId = await ctx.runMutation(internal.ideSync.enqueueIdeOp, {
        deviceId,
        projectId: panel.projectId,
        opType: "upsertUser",
        // create_data: id zaten varsa panel günceller (idempotent varsayımı — canlı doğrulanmalı).
        payload: { mode: "create", userRecord: { id: cardNo, status, permissions } },
      });
      opIds.push(userOpId);
      queued++;
    }
    return { ok: true, queued, skipped, opIds };
  },
});

/**
 * Çalışanı (hâlâ DB'de varken) bağlı olduğu IDE panellerinden sil (MQTT kuyruğu).
 * id=cardNumber. internalAction (scheduler/mutation tetikli).
 */
export const deleteEmployeeFromIdePanels = internalAction({
  args: { employeeId: v.id("employees") },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; queued: number; error?: string }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });
    if (!data) return { ok: false, queued: 0, error: "Çalışan bulunamadı" };
    const cardNo = Number(data.employee.cardNumber);
    if (!Number.isSafeInteger(cardNo) || cardNo < 1) {
      return { ok: false, queued: 0, error: "Kart numarası IDE için geçersiz" };
    }

    const seen = new Set<string>();
    let queued = 0;
    for (const dr of data.deviceRules) {
      if (dr.device.brand !== "ide_smart" || seen.has(dr.device._id)) continue;
      seen.add(dr.device._id);
      const panel = await ctx.runQuery(internal.devices.getByIdInternal, { id: dr.device._id });
      if (!panel?.ideUuid) continue;
      await ctx.runMutation(internal.ideSync.enqueueIdeOp, {
        deviceId: dr.device._id,
        projectId: panel.projectId,
        opType: "deleteUser",
        payload: { ideUserId: cardNo },
      });
      queued++;
    }
    return { ok: true, queued };
  },
});

/**
 * Belirli IDE panellerinden bir kart numarasını sil (MQTT kuyruğu) — çağıran
 * cardNumber + deviceId listesini AÇIKÇA verir. employees.remove gibi DB kaydı (ve
 * groupMembers) silindikten sonra getEmployeeWithDevices null döneceği için, ya da
 * kart no değişiminde ESKİ kartı sökmek için kullanılır. Çözümleme, çağıran mutation'da
 * commit ÖNCESİ yapılıp buraya parametre olarak geçirilir.
 */
export const deleteIdeUserFromPanels = internalAction({
  args: {
    cardNumber: v.string(),
    deviceIds: v.array(v.id("devices")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; queued: number }> => {
    const cardNo = Number(args.cardNumber);
    if (!Number.isSafeInteger(cardNo) || cardNo < 1) return { ok: false, queued: 0 };
    const seen = new Set<string>();
    let queued = 0;
    for (const deviceId of args.deviceIds) {
      if (seen.has(deviceId)) continue;
      seen.add(deviceId);
      const panel = await ctx.runQuery(internal.devices.getByIdInternal, { id: deviceId });
      if (!panel || panel.brand !== "ide_smart" || !panel.ideUuid) continue;
      await ctx.runMutation(internal.ideSync.enqueueIdeOp, {
        deviceId,
        projectId: panel.projectId ?? args.projectId,
        opType: "deleteUser",
        payload: { ideUserId: cardNo },
      });
      queued++;
    }
    return { ok: true, queued };
  },
});

/**
 * Erişim kuralını (permission) bağlı IDE panellerine yaz (MQTT kuyruğu).
 * accessRule → IdePermissionRecord: id=idePermissionNo, io=panel kapıları, schedule=saat/gün.
 * internalAction (scheduler/mutation tetikli; yetki tetikleyen mutation'da denetlenir).
 */
export const syncPermissionToIdePanels = internalAction({
  args: { accessRuleId: v.id("accessRules") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    queued: number;
    skipped: string[];
    opIds: Id<"idePendingOperations">[];
    error?: string;
  }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getAccessRuleWithDevices, {
      accessRuleId: args.accessRuleId,
    });
    if (!data) return { ok: false, queued: 0, skipped: [], opIds: [], error: "Erişim kuralı bulunamadı" };

    // idePermissionNo (yoksa atomik ata).
    const permNo = await ctx.runMutation(internal.ideSync.ensureIdePermissionNo, {
      accessRuleId: args.accessRuleId,
    });

    const seen = new Set<string>();
    const skipped: string[] = [];
    const opIds: Id<"idePendingOperations">[] = [];
    let queued = 0;
    for (const device of data.devices) {
      if (device.brand !== "ide_smart" || seen.has(device._id)) continue;
      seen.add(device._id);
      const panel = await ctx.runQuery(internal.devices.getByIdInternal, { id: device._id });
      if (!panel?.ideUuid) continue;

      const ioIds = await ctx.runQuery(internal.ideSync.getIdePanelIoIds, { deviceId: device._id });
      const droppedIo = outOfRangeIoIds(ioIds);
      if (droppedIo.length > 0) {
        skipped.push(`${panel.name}: spec-dışı io ${droppedIo.join(",")} atlandı (0–7 beklenir)`);
      }
      const permissionRecord = buildIdePermissionRecord(permNo, ioIds, {
        startTime: data.rule.startTime,
        endTime: data.rule.endTime,
        days: data.rule.days,
      });
      const permOpId = await ctx.runMutation(internal.ideSync.enqueueIdeOp, {
        deviceId: device._id,
        projectId: panel.projectId,
        opType: "upsertPermission",
        payload: { mode: "create", permissionRecord },
      });
      opIds.push(permOpId);
      queued++;
    }
    return { ok: true, queued, skipped, opIds };
  },
});

/**
 * UI-tetikli: bir erişim kuralını bağlı IDE panellerine yaz VE panel ack'lerini kısa
 * süre bekleyip toplu sonuç döndür (Hikvision'ın senkron toast UX'inin MQTT eşdeğeri).
 *
 * İş: permission record + kuralın TÜM aktif üyelerinin user record'unu enqueue eder
 * (op'lar idempotent; mutation scheduler'ı zaten aynı op'ları kuyruğa attıysa aynı
 * op'lara çözülür), opId'leri toplar, hepsi terminal (acked/failed) olana ya da
 * ACK_WAIT_MS dolana kadar poll eder. Yetki: tetikleyen mutation'da + burada (proje).
 */
const ACK_WAIT_MS = 8_000;
const ACK_POLL_INTERVAL_MS = 1_500;

export const syncRuleToIdePanelsAndWait = authedAction({
  args: { accessRuleId: v.id("accessRules") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    panels: number;
    queued: number;
    acked: number;
    failed: number;
    pending: number;
    skipped: string[];
    errors: string[];
  }> => {
    const empty = {
      panels: 0,
      queued: 0,
      acked: 0,
      failed: 0,
      pending: 0,
      skipped: [] as string[],
      errors: [] as string[],
    };
    const data = await ctx.runQuery(internal.hikvisionSync.getAccessRuleWithDevices, {
      accessRuleId: args.accessRuleId,
    });
    if (!data) return empty;

    const allowedProjectIds: Id<"projects">[] = await ctx.runQuery(
      internal.users.listProjectIdsForCurrentUser,
      {},
    );
    if (!isProjectAllowed(allowedProjectIds, data.rule.projectId)) return empty;

    const idePanels = data.devices.filter((d) => d.brand === "ide_smart");
    if (idePanels.length === 0) return empty;

    const opIds: Id<"idePendingOperations">[] = [];
    const skipped: string[] = [];

    // Permission RECORD'u önce (user.permissions referansı panelde bulunsun).
    const perm = await ctx.runAction(
      internal.actions.ideGatewayDevice.syncPermissionToIdePanels,
      { accessRuleId: args.accessRuleId },
    );
    opIds.push(...perm.opIds);
    skipped.push(...perm.skipped);

    // Üyelerin user record'ları (permission ensure edildikten sonra paralel güvenli).
    const memberResults = await Promise.all(
      data.employees.map((emp) =>
        ctx.runAction(internal.actions.ideGatewayDevice.syncEmployeeToIdePanels, {
          employeeId: emp._id as Id<"employees">,
        }),
      ),
    );
    for (const r of memberResults) {
      opIds.push(...r.opIds);
      skipped.push(...r.skipped);
    }

    const uniqueOpIds = Array.from(new Set(opIds));
    if (uniqueOpIds.length === 0) {
      return { ...empty, panels: idePanels.length, skipped };
    }

    // Panel ack'lerini bekle: bridge ~2sn'de çekiyor, çoğu op ACK_WAIT_MS içinde terminal olur.
    const deadline = Date.now() + ACK_WAIT_MS;
    let statuses = await ctx.runQuery(internal.ideSync.getOpStatuses, { opIds: uniqueOpIds });
    while (
      Date.now() < deadline &&
      statuses.some((s) => s.status === "pending" || s.status === "sent")
    ) {
      await new Promise((resolve) => setTimeout(resolve, ACK_POLL_INTERVAL_MS));
      statuses = await ctx.runQuery(internal.ideSync.getOpStatuses, { opIds: uniqueOpIds });
    }

    const acked = statuses.filter((s) => s.status === "acked").length;
    const failed = statuses.filter((s) => s.status === "failed").length;
    const pending = statuses.filter(
      (s) => s.status === "pending" || s.status === "sent",
    ).length;
    const errors = statuses
      .filter((s) => s.status === "failed")
      .map((s) => `${s.opType}: ${s.lastError ?? "bilinmeyen hata"}`);

    return {
      panels: idePanels.length,
      queued: uniqueOpIds.length,
      acked,
      failed,
      pending,
      skipped,
      errors,
    };
  },
});

export const openIdeDoor = authedAction({
  args: {
    deviceId: v.id("devices"),
    doorId: v.id("doors"),
    keep: v.optional(v.union(v.literal(0), v.literal(1))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; queued?: boolean; error?: string }> => {
    const loaded = await loadIdePanel(ctx, args.deviceId);
    if ("error" in loaded) return { ok: false, error: loaded.error };
    const { device } = loaded;

    const door = await ctx.runQuery(internal.doors.getByIdInternal, {
      id: args.doorId,
    });
    if (!door || typeof door.ioId !== "number") {
      return { ok: false, error: "Kapı bulunamadı veya aktüatör (io_id) tanımsız" };
    }
    // Kapı bu panele bağlı olmalı (cross-tenant/yanlış kapı koruması).
    if (door.deviceId !== device._id) {
      return { ok: false, error: "Kapı bu panele ait değil" };
    }

    const keep: 0 | 1 = args.keep === 0 ? 0 : 1;

    // Komut kuyruğa gider, bridge broker'a publish eder (panel LAN'da, MQTT ile bağlı).
    await ctx.runMutation(internal.ideSync.enqueueIdeOp, {
      deviceId: device._id,
      projectId: device.projectId,
      opType: "openDoor",
      payload: { ioId: door.ioId, keep },
    });
    return { ok: true, queued: true };
  },
});
