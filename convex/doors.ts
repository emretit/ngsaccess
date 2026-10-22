import { doorStatusPlanValidator, normalizeDoorStatusPlan } from "./lib/doorStatusPlan";

import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { authedQuery, adminMutation } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { resolveProjectScope } from "./lib/projectScope";
import { deleteReadersForDoor } from "./readers";
import { deleteGroupDoorsForDoor } from "./lib/deviceHelpers";
import { deriveHikReaderNoFromDoorNo } from "./lib/hikReaderNumbers";
import { ruleDiffSyncPlan } from "./lib/accessRuleDiff";
import { createRuleDiffRun } from "./deviceSyncRuns";

type ReaderDirection = "entry" | "exit" | "both";

/** Kuralın üyeleri + kapsadığı cihazlar (doğrudan cihaz bağı ∪ kapı bağlarının cihazı). */
async function ruleSyncScope(
  ctx: MutationCtx,
  ruleId: Id<"accessRules">,
  projectId: Id<"projects">,
): Promise<{ memberIds: Id<"employees">[]; deviceIds: Id<"devices">[] }> {
  const [members, deviceLinks, doorLinks] = await Promise.all([
    ctx.db.query("groupMembers").withIndex("by_project_group", (q) => q.eq("projectId", projectId).eq("groupId", ruleId)).collect(),
    ctx.db.query("groupDevices").withIndex("by_project_group", (q) => q.eq("projectId", projectId).eq("groupId", ruleId)).collect(),
    ctx.db.query("groupDoors").withIndex("by_group", (q) => q.eq("groupId", ruleId)).collect(),
  ]);
  const doors = await Promise.all(doorLinks.map((link) => ctx.db.get(link.doorId)));
  return {
    memberIds: members.map((m) => m.employeeId),
    deviceIds: [...new Set([
      ...deviceLinks.map((link) => link.deviceId),
      ...doors.flatMap((d) => (d?.deviceId ? [d.deviceId] : [])),
    ])],
  };
}

/**
 * Silinen kapı kuralın kapsamını daraltır: kural düzenlemedeki kapı-çıkarma ile aynı
 * fark gönderimini (kapsam değişti planı) başlat ki panel yetkileri ve roster'ı
 * güncellensin. Kural başına ayrı transaction: her run ≤200 cihaz işi zamanlar, kapı
 * silme mutation'ı kural sayısı × cihaz kadar iş biriktirip zamanlama sınırına takılmaz.
 * Silme anının üye/cihaz snapshot'ı güncel durumla birleştirilir: arada kuraldan çıkarılan
 * üye de eski panelden sökülür (hedef, erişimi güncel veriden yeniden hesaplar).
 * Sınır aşımı (200 cihaz / 500 kişi) o kural için gönderimi atlar.
 */
export const syncRuleAfterDoorRemoval = internalMutation({
  args: {
    ruleId: v.id("accessRules"),
    startedBy: v.id("users"),
    memberIds: v.array(v.id("employees")),
    beforeDeviceIds: v.array(v.id("devices")),
  },
  handler: async (ctx, args) => {
    const { ruleId } = args;
    const rule = await ctx.db.get(ruleId);
    const projectId = rule?.projectId;
    if (!projectId) return;
    const current = await ruleSyncScope(ctx, ruleId, projectId);
    const memberIds = [...new Set([...args.memberIds, ...current.memberIds])];
    const beforeDeviceIds = [...new Set([...args.beforeDeviceIds, ...current.deviceIds])];
    const plan = ruleDiffSyncPlan({
      live: memberIds, next: memberIds, scopeChanged: true, settingsChanged: false, activeChanged: false,
    });
    try {
      await createRuleDiffRun(ctx, { ruleId, projectId, startedBy: args.startedBy, beforeDeviceIds, plan });
    } catch (error: unknown) {
      if (!(error instanceof ConvexError)) throw error;
      console.warn(`doors.remove: kural ${ruleId} fark gönderimi atlandı`, error.data);
    }
  },
});

/**
 * Kapı IDE Smart panele bağlıysa (deviceId → brand ide_smart, ioId var) sensör onayı
 * ayarını panele yaz: ACTUATOR{ioId}.REQUIRE_SENSOR_ACTIVATION = requireSensor ? 1 : 0.
 * Sensörsüz kapıda 1 kalırsa actuator "busy"de takılır (docs §9.1 Step 1).
 */
async function scheduleSensorSync(
  ctx: MutationCtx,
  deviceId: Id<"devices"> | undefined,
  ioId: number | undefined,
  requireSensor: boolean,
): Promise<void> {
  if (!deviceId || typeof ioId !== "number") return;
  const device = await ctx.db.get(deviceId);
  if (!device || device.brand !== "ide_smart") return;
  const parameterName = `ACTUATOR${ioId}.REQUIRE_SENSOR_ACTIVATION`;
  await ctx.scheduler.runAfter(0, internal.ideSync.enqueueIdeOp, {
    deviceId,
    projectId: device.projectId,
    opType: "parameterWrite",
    payload: {
      parameterName,
      parameterRecord: { [parameterName]: requireSensor ? 1 : 0 },
    },
  });
}

// IDE Smart aktüatör index'ine göre okuyucu yön etiketini türetir.
// cardReadings.resolveDirection ile aynı eşleme: io 0=entry, 1=exit, diğer=both.
function directionFromIo(io: number | undefined): ReaderDirection {
  if (io === 0) return "entry";
  if (io === 1) return "exit";
  return "both";
}

// Son okuma/heartbeat bu pencere içindeyse okuyucu çevrimiçi sayılır.
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export const list = authedQuery({
  args: {
    zoneId: v.optional(v.id("zones")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId);
      if (!zone) return [];
      if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
        return [];
      }
      const zoneDoors = await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
        .collect();
      // Defense-in-depth: zone bazlı RBAC'tan geçen kapıları ayrıca door.projectId
      // ile süz — başka tenant'ın kapısı bu zone'a (hatalı/eski pointer) işaret
      // ediyorsa sızdırma. isProjectAllowed undefined projectId'yi de eler (orphan
      // kapı gösterilmez). super_admin tüm projelere yetkili olduğundan etkilenmez.
      if (ctx.user.role === "super_admin") return zoneDoors;
      return zoneDoors.filter((d) => isProjectAllowed(allowedProjectIds, d.projectId));
    }
    if (args.projectId) {
      // Aktif proje filtresi — super_admin dahil yalnızca seçili projenin kapıları.
      if (!allowedProjectIds.some((id) => id === args.projectId)) return [];
      return await ctx.db
        .query("doors")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    }
    if (ctx.user.role === "super_admin") return await ctx.db.query("doors").collect();
    if (allowedProjectIds.length === 0) return [];
    const results = await Promise.all(
      allowedProjectIds.map((pid) =>
        ctx.db
          .query("doors")
          .withIndex("by_project", (q) => q.eq("projectId", pid))
          .collect()
      )
    );
    return results.flat();
  },
});

export const create = adminMutation({
  args: {
    name: v.string(),
    projectId: v.optional(v.id("projects")),
    zoneId: v.optional(v.id("zones")),
    deviceId: v.optional(v.id("devices")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
    ioId: v.optional(v.number()),
    requireSensor: v.optional(v.boolean()),
    readerDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    hikDoorNo: v.optional(v.number()),
    hikDoorStatusPlan: v.optional(doorStatusPlanValidator),
    hikVerifyPlan: v.optional(
      v.object({
        enabled: v.boolean(),
        beginTime: v.string(),
        endTime: v.string(),
        verifyMode: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const targetZone = args.zoneId ? await ctx.db.get(args.zoneId) : null;
    const targetDevice = args.deviceId ? await ctx.db.get(args.deviceId) : null;
    if (args.zoneId && !targetZone) throw new ConvexError("Bölge bulunamadı");
    if (args.deviceId && !targetDevice) throw new ConvexError("Cihaz bulunamadı");
    const projectId = args.projectId ?? targetZone?.projectId ?? targetDevice?.projectId;
    if (!projectId) {
      throw new ConvexError("Kapı oluşturmak için bir proje seçmelisiniz");
    }
    if (!isProjectAllowed(allowedProjectIds, projectId)) {
      throw new ConvexError("Bu projeye erişim yetkiniz yok");
    }
    if (targetZone) {
      if (!isProjectAllowed(allowedProjectIds, targetZone.projectId)) {
        throw new ConvexError("Bu bölgeye erişim yetkiniz yok");
      }
      if (targetZone.projectId !== projectId) {
        throw new ConvexError("Seçilen bölge bu kapının projesinde değil");
      }
    }
    if (targetDevice) {
      if (!isProjectAllowed(allowedProjectIds, targetDevice.projectId)) {
        throw new ConvexError("Bu cihaza erişim yetkiniz yok");
      }
      if (targetDevice.projectId !== projectId) {
        throw new ConvexError("Seçilen cihaz bu kapının projesinde değil");
      }
    }
    const hikDoorStatusPlan = args.hikDoorStatusPlan ? normalizeDoorStatusPlan(args.hikDoorStatusPlan) : undefined;
    const now = new Date().toISOString();
    const doorId = await ctx.db.insert("doors", {
      ...args,
      hikDoorStatusPlan,
      projectId,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });
    // Her kapı en az bir okuyucuyla doğar (kapı↔okuyucu ayrı tablo). Yön: verilen
    // readerDirection veya ioId'den türetilir. Böylece readerStatus legacy fallback'e
    // düşmeden çoklu-okuyucu modeliyle tutarlı olur.
    const readerDirection = args.readerDirection ?? directionFromIo(args.ioId);
    await ctx.db.insert("readers", {
      doorId,
      deviceId: args.deviceId,
      projectId,
      zoneId: args.zoneId,
      name: args.name,
      direction: readerDirection,
      hikReaderNo: deriveHikReaderNoFromDoorNo(args.hikDoorNo, readerDirection),
      ioId: args.ioId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    if (args.requireSensor !== undefined) {
      await scheduleSensorSync(ctx, args.deviceId, args.ioId, args.requireSensor);
    }
    return doorId;
  },
});

export const update = adminMutation({
  args: {
    doorId: v.id("doors"),
    name: v.optional(v.string()),
    zoneId: v.optional(v.id("zones")),
    deviceId: v.optional(v.id("devices")),
    location: v.optional(v.string()),
    doorCode: v.optional(v.string()),
    status: v.optional(v.string()),
    ioId: v.optional(v.number()),
    requireSensor: v.optional(v.boolean()),
    readerName: v.optional(v.string()),
    readerDirection: v.optional(
      v.union(v.literal("entry"), v.literal("exit"), v.literal("both"))
    ),
    hikDoorNo: v.optional(v.number()),
    hikDoorStatusPlan: v.optional(doorStatusPlanValidator),
    hikVerifyPlan: v.optional(
      v.object({
        enabled: v.boolean(),
        beginTime: v.string(),
        endTime: v.string(),
        verifyMode: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    const door = await ctx.db.get(args.doorId);
    if (!door) throw new Error("Kapı bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, door.projectId)) {
      throw new Error("Bu kapıya erişim yetkiniz yok");
    }
    // args.zoneId verildiyse hedef bölgenin sahibini doğrula (cross-tenant pointer
    // engeli; readerStatus/list zone bazlı RBAC yaptığından sızıntıyı önler).
    if (args.zoneId !== undefined) {
      const targetZone = await ctx.db.get(args.zoneId);
      if (!targetZone) throw new Error("Bölge bulunamadı");
      if (!isProjectAllowed(allowedProjectIds, targetZone.projectId)) {
        throw new Error("Bu bölgeye erişim yetkiniz yok");
      }
      if (targetZone.projectId !== door.projectId) {
        throw new Error("Seçilen bölge bu kapının projesinde değil");
      }
    }
    const deviceId = args.deviceId ?? door.deviceId;
    if (deviceId) {
      const device = await ctx.db.get(deviceId);
      if (!device) throw new Error("Cihaz bulunamadı");
      if (device.projectId !== door.projectId) {
        throw new Error("Seçilen cihaz bu kapının projesinde değil");
      }
    }
    const { doorId, ...updates } = args;
    if (updates.hikDoorStatusPlan) updates.hikDoorStatusPlan = normalizeDoorStatusPlan(updates.hikDoorStatusPlan);
    const now = new Date().toISOString();
    await ctx.db.patch(doorId, { ...updates, updatedAt: now });
    if (args.hikDoorNo !== undefined) {
      const readers = await ctx.db
        .query("readers")
        .withIndex("by_door", (q) => q.eq("doorId", doorId))
        .collect();
      await Promise.all(
        readers.map((reader) =>
          ctx.db.patch(reader._id, {
            hikReaderNo: deriveHikReaderNoFromDoorNo(args.hikDoorNo, reader.direction),
            updatedAt: now,
          }),
        ),
      );
    }
    // Sensör ayarı değiştiyse panele yaz (ioId güncellenmiş olabilir → yeni değer öncelikli).
    if (args.requireSensor !== undefined) {
      await scheduleSensorSync(
        ctx,
        deviceId,
        args.ioId ?? door.ioId,
        args.requireSensor,
      );
    }
  },
});

export const remove = adminMutation({
  args: { doorId: v.id("doors") },
  handler: async (ctx, args) => {
    const allowedProjectIds = await resolveProjectScope(ctx);
    const door = await ctx.db.get(args.doorId);
    if (!door) throw new ConvexError("Kapı bulunamadı");
    if (!isProjectAllowed(allowedProjectIds, door.projectId)) {
      throw new ConvexError("Bu kapıya erişim yetkiniz yok");
    }
    if (door.deviceId) {
      const owner = await ctx.db.get(door.deviceId);
      if (owner?.brand === "ide_smart") {
        throw new ConvexError(
          "Bu kapı bir IDE Smart paneline ait — kapıları paneli silerek kaldırın.",
        );
      }
    }
    // Bağlar silinmeden önce etkilenen kuralların kapsamını yakala (cihazsız kapı panele dokunmaz).
    // Ölçek notu: okuma = Σ(kural üyesi + bağı); ~60 kural × 500 üye bu transaction'ı tarama
    // sınırına (32K) taşır — kural diff ölçeği işiyle (E2) birlikte ele alınacak.
    const doorLinks = door.deviceId
      ? await ctx.db.query("groupDoors").withIndex("by_door", (q) => q.eq("doorId", args.doorId)).collect()
      : [];
    const linkedRuleIds = [...new Set(doorLinks.map((link) => link.groupId))];
    const ruleSnapshots = (await Promise.all(linkedRuleIds.map(async (ruleId) => {
      const projectId = (await ctx.db.get(ruleId))?.projectId;
      if (!projectId) return [];
      const scope = await ruleSyncScope(ctx, ruleId, projectId);
      return [{ ruleId, memberIds: scope.memberIds, beforeDeviceIds: scope.deviceIds }];
    }))).flat();
    // Önce kapının okuyucularını sil (cascade) — orphan reader sızıntısı engeli.
    await deleteReadersForDoor(ctx, args.doorId);
    await deleteGroupDoorsForDoor(ctx, args.doorId);
    await ctx.db.delete(args.doorId);
    await Promise.all(ruleSnapshots.map((snapshot) =>
      ctx.scheduler.runAfter(0, internal.doors.syncRuleAfterDoorRemoval, { ...snapshot, startedBy: ctx.user._id })));
  },
});

/**
 * Her kapının "okuyucu yüzü" + canlı durumu. Kapı ağacında alt-satır olarak gösterilir.
 * IDE Smart kapıları: son okuma panel cihazı + ioId ile çözülür. Diğer markalar:
 * doorId ile bağlı cihazın son okuması. Çevrimiçi = son okuma veya panel.lastSeen pencere içinde.
 */
export const readerStatus = authedQuery({
  args: {
    zoneId: v.optional(v.id("zones")),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    // 1) Kapsamdaki kapılar (list ile aynı erişim mantığı)
    let doors: Doc<"doors">[];
    if (args.zoneId) {
      const zone = await ctx.db.get(args.zoneId);
      if (!zone) return [];
      if (zone.projectId && !allowedProjectIds.some((id) => id === zone.projectId)) {
        return [];
      }
      const zoneDoors = await ctx.db
        .query("doors")
        .withIndex("by_zone", (q) => q.eq("zoneId", args.zoneId))
        .collect();
      // Defense-in-depth: zone üzerinden çekilen kapıları door.projectId ile süz —
      // başka tenant'ın kapısı bu zone'a işaret ediyorsa kart okuma verisi sızmasın.
      // isProjectAllowed undefined projectId'yi de eler (list ile aynı semantik).
      doors =
        ctx.user.role === "super_admin"
          ? zoneDoors
          : zoneDoors.filter((d) => isProjectAllowed(allowedProjectIds, d.projectId));
    } else if (args.projectId) {
      if (!allowedProjectIds.some((id) => id === args.projectId)) return [];
      doors = await ctx.db
        .query("doors")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect();
    } else if (ctx.user.role === "super_admin") {
      doors = await ctx.db.query("doors").collect();
    } else if (allowedProjectIds.length === 0) {
      return [];
    } else {
      const results = await Promise.all(
        allowedProjectIds.map((pid) =>
          ctx.db
            .query("doors")
            .withIndex("by_project", (q) => q.eq("projectId", pid))
            .collect()
        )
      );
      doors = results.flat();
    }

    // 2) Kapının paneli (door.deviceId) → cihaz başına bir kez çöz
    const panelDeviceIds = Array.from(
      new Set(
        doors
          .map((d) => d.deviceId)
          .filter((id): id is NonNullable<typeof id> => id != null)
      )
    );
    const panelById = new Map<string, Doc<"devices"> | null>();
    await Promise.all(
      panelDeviceIds.map(async (did) => {
        panelById.set(String(did), await ctx.db.get(did));
      })
    );

    const now = Date.now();
    const within = (iso: string | null | undefined): boolean =>
      iso ? now - new Date(iso).getTime() < ONLINE_WINDOW_MS : false;

    // 3) Her kapı için son okuma + çevrimiçi bayrağını BİR KEZ hesapla, okuyuculara paylaştır.
    //    Yalnız gerçek readers satırları döner. Okuyucu taşınınca kaynak kapıda okuyucu
    //    görünmemesi için artık legacy/sentetik satır üretmiyoruz.
    //    Hik event'i hangi okuyucudan geldiğini bildirmediğinden bir kapının okuyucuları aynı
    //    son-okumayı paylaşır (izin kapı bazlı).
    const perDoor = await Promise.all(
      doors.map(async (door) => {
        const linkedPanel = door.deviceId
          ? panelById.get(String(door.deviceId)) ?? null
          : null;
        const panel = linkedPanel?.projectId === door.projectId ? linkedPanel : null;
        const invalidPanel = Boolean(door.deviceId && !panel);

        let last: Doc<"cardReadings"> | null = null;
        const io = door.ioId;
        if (panel && io !== undefined) {
          const panelId = panel._id;
          last = await ctx.db
            .query("cardReadings")
            .withIndex("by_device_io_time", (q) =>
              q.eq("deviceId", panelId).eq("ideIoId", io)
            )
            .order("desc")
            .first();
        } else if (!invalidPanel) {
          const dev = await ctx.db
            .query("devices")
            .filter((q) => q.eq(q.field("doorId"), door._id))
            .first();
          if (dev && dev.projectId === door.projectId) {
            last = await ctx.db
              .query("cardReadings")
              .withIndex("by_device", (q) => q.eq("deviceId", dev._id))
              .order("desc")
              .first();
          }
        }

        if (last && last.projectId !== door.projectId) last = null;
        if (last?.employeeId) {
          const employee = await ctx.db.get(last.employeeId);
          if (!employee || employee.projectId !== door.projectId) last = null;
        }
        const base = {
          doorId: door._id,
          lastReadAt: last?.accessTime ?? null,
          lastCardNo: last?.cardNo ?? null,
          lastEmployeeName: last?.employeeName ?? null,
          lastStatus: last?.accessStatus ?? null,
          lastDirection: last?.direction ?? null,
          online: within(last?.accessTime) || within(panel?.lastSeen),
        };

        const doorReaders = await ctx.db
          .query("readers")
          .withIndex("by_door", (q) => q.eq("doorId", door._id))
          .collect();

        return doorReaders.map((r) => ({
          readerId: r._id as Id<"readers"> | null,
          readerName: r.name,
          readerDirection: r.direction,
          hikReaderNo: r.hikReaderNo ?? null,
          hikLastCfgAt: r.hikLastCfgAt ?? null,
          hikCardReaderName: r.hikCardReaderName ?? null,
          hikCardReaderPlanTemplateNo: r.hikCardReaderPlanTemplateNo ?? null,
          hikCardReaderAntiSneakEnabled: r.hikCardReaderAntiSneakEnabled ?? null,
          ...base,
          ...(r.projectId !== door.projectId || r.deviceId !== door.deviceId
            ? { lastReadAt: null, lastCardNo: null, lastEmployeeName: null,
                lastStatus: null, lastDirection: null, online: false }
            : {}),
        }));
      })
    );
    return perDoor.flat();
  },
});

/** Action'lardan kapı (ioId dahil) çözümü için. */
export const getByIdInternal = internalQuery({
  args: { id: v.id("doors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
