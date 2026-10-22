import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { employeeWithinAccessEpoch, genericReaderTokenAllowed } from "./mobileAccess";
import { inferAccessStatus, inferDenialReason } from "./hikEventCodes";
import { ideResultGranted } from "./cardReaderParse";
import { canEmployeeAccessDevice } from "./accessDecision";
import { ideTimeToISO, resolveDirection, resolveActiveMatchingRuleIds } from "./cardReadingProcess";
import { getEffectiveWorkSettings, isoTimeToTRMinutes } from "./pdksHelpers";
import { buildShiftResolver, thresholdsForShift } from "./shiftResolver";
import { trDateKey } from "./trDate";

export interface ProcessCardReadingArgs {
  cardNo: string;
  deviceSerial: string;
  deviceIp?: string;
  authedDeviceId?: Id<"devices">;
  rawBody?: string;
  hikDevIndex?: string;
  hikEhomeID?: string;
  hikMajorEventType?: number;
  hikSubEventType?: number;
  hikCurrentVerifyMode?: string;
  hikSerialNo?: number;
  hikFrontSerialNo?: number;
  hikDateTime?: string;
  hikPictureURL?: string;
  hikMask?: string;
  hikHelmet?: string;
  hikTemperature?: number;
  hikEventState?: string;
  ideUuid?: string;
  ideIoId?: number;
  ideResult?: number;
  ideTime?: string;
}

type FindDeviceCardEmployee = (
  ctx: MutationCtx,
  cardNo: string,
  projectId?: Id<"projects">,
) => Promise<Doc<"employees"> | null>;

type ReadingState = {
  accessTime: string;
  projectForRow: (employeeProject?: Id<"projects">, deviceProject?: Id<"projects">) => Id<"projects"> | undefined;
  hikFields: Pick<ProcessCardReadingArgs,
    "hikDevIndex" | "hikMajorEventType" | "hikSubEventType" | "hikCurrentVerifyMode" |
    "hikSerialNo" | "hikFrontSerialNo" | "hikDateTime" | "hikPictureURL" |
    "hikMask" | "hikHelmet" | "hikTemperature" | "hikEventState">;
  findDeviceCardEmployee: FindDeviceCardEmployee;
};

/** Live reader orchestration. Phase calls preserve the original DB/scheduler order. */
export async function processCardReadingCore(
  ctx: MutationCtx,
  args: ProcessCardReadingArgs,
  findDeviceCardEmployee: FindDeviceCardEmployee,
): Promise<{ granted: boolean }> {
  const accessTime = new Date().toISOString();
  const firstProjectId = (await ctx.db.query("projects").first())?._id;
  const projectForRow = (
    employeeProject: typeof firstProjectId,
    deviceProject: typeof firstProjectId
  ) => employeeProject ?? deviceProject ?? firstProjectId;

  // Tüm cardReadings insert'lerine spread edilecek Hikvision metadata
  const hikFields = {
    hikDevIndex: args.hikDevIndex,
    hikMajorEventType: args.hikMajorEventType,
    hikSubEventType: args.hikSubEventType,
    hikCurrentVerifyMode: args.hikCurrentVerifyMode,
    hikSerialNo: args.hikSerialNo,
    hikFrontSerialNo: args.hikFrontSerialNo,
    hikDateTime: args.hikDateTime,
    hikPictureURL: args.hikPictureURL,
    hikMask: args.hikMask,
    hikHelmet: args.hikHelmet,
    hikTemperature: args.hikTemperature,
    hikEventState: args.hikEventState,
  } as const;

  const state: ReadingState = { accessTime, projectForRow, hikFields, findDeviceCardEmployee };
  const device = await resolveReadingDevice(ctx, args);

  // Reader credentials must never be misinterpreted as native IDE/Hik card identifiers.
  const isReaderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.cardNo);
  if (isReaderUuid && (!args.authedDeviceId || device?.brand === "ide_smart" || device?.brand === "hikvision")) return { granted: false };

  // Panels decide access themselves; generic readers continue to server rules.
  if (device?.brand === "hikvision") return persistHikvisionReading(ctx, args, device, state);
  if (device?.brand === "ide_smart") return persistIdeReading(ctx, args, device, state);

  // Reader-purpose UUIDs can only be consumed by authenticated generic readers.
  const isToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.cardNo);
  if (isToken) return consumeReaderToken(ctx, args, device);

  return processGenericCardReading(ctx, args, device, state);
}

async function resolveReadingDevice(ctx: MutationCtx, args: ProcessCardReadingArgs): Promise<Doc<"devices"> | null> {
  // 1. Cihazı bul. Token doğrulanmış istekte (authedDeviceId) attribution o cihaza
  //    SABİTLENİR — body'deki serial/IP/uuid'ye GÜVENİLMEZ. Bu, /card-reader'daki
  //    localBridge guard-skip + IP-global lookup ile bir token sahibinin BAŞKA tenant'ın
  //    cihazına forged kart/audit satırı yazmasını engeller. Token yoksa (deprecated
  //    unauth yol) eski serial→devIndex→ehome→uuid→IP zincirine düşülür.
  let device: Doc<"devices"> | null = null;
  if (args.authedDeviceId) {
    device = await ctx.db.get(args.authedDeviceId);
  } else {
    if (args.deviceSerial?.trim()) {
      const deviceSerial = args.deviceSerial.trim();
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_serial", (q) =>
          q.eq("deviceSerial", deviceSerial)
        )
        .first();
    }
    // Gateway-passthrough event'inde serial yerine devIndex gelir → indexli lookup
    if (!device && args.hikDevIndex?.trim()) {
      const hikDevIndex = args.hikDevIndex.trim();
      device = await ctx.db
        .query("devices")
        .withIndex("by_hik_dev_index", (q) =>
          q.eq("hikDevIndex", hikDevIndex)
        )
        .first();
    }
    // Cihaz event'i `deviceID` field'ında ehomeID gönderir (gateway register'da atadığımız)
    if (!device && args.hikEhomeID?.trim()) {
      const hikEhomeID = args.hikEhomeID.trim();
      device = await ctx.db
        .query("devices")
        .withIndex("by_ehome_id", (q) =>
          q.eq("ehomeID", hikEhomeID)
        )
        .first();
    }
    // IDE Smart panel event'i: serial yerine panel UUID gelebilir.
    if (!device && args.ideUuid?.trim()) {
      const ideUuid = args.ideUuid.trim();
      device = await ctx.db
        .query("devices")
        .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
        .first();
    }
    if (!device && args.deviceIp?.trim()) {
      const deviceIp = args.deviceIp.trim();
      device = await ctx.db
        .query("devices")
        .withIndex("by_device_ip", (q) =>
          q.eq("deviceIp", deviceIp)
        )
        .first();
    }
  }

  return device;
}

async function persistHikvisionReading(
  ctx: MutationCtx,
  args: ProcessCardReadingArgs,
  device: Doc<"devices">,
  state: ReadingState,
): Promise<{ granted: boolean }> {
  const { accessTime, projectForRow, hikFields, findDeviceCardEmployee } = state;
  const inferred = inferAccessStatus(
    args.hikMajorEventType,
    args.hikSubEventType,
  );
  const accessStatus: "izin_verildi" | "reddedildi" =
    inferred ?? "reddedildi";
  const granted = accessStatus === "izin_verildi";
  const denialReason = granted
    ? undefined
    : inferDenialReason(args.hikSubEventType);

  const employee = await findDeviceCardEmployee(ctx, args.cardNo, device?.projectId);

  const direction = employee
    ? await resolveDirection(ctx, {
        device,
        employeeId: employee._id,
        nowISO: accessTime,
      })
    : undefined;

  // serialNo gap detection — event ardışıklığı bozulduysa AcsEvent backfill için işaretle.
  // Şimdilik sadece warn log; Phase 5.2'de history backfill kuyruğu eklenecek.
  if (
    args.hikSerialNo !== undefined &&
    args.hikFrontSerialNo !== undefined &&
    device.hikLastSerialNo !== undefined &&
    args.hikFrontSerialNo !== device.hikLastSerialNo
  ) {
    console.warn(
      `[hik-event-gap] device=${device.name} expected front=${device.hikLastSerialNo} got=${args.hikFrontSerialNo} current=${args.hikSerialNo}`,
    );
  }
  if (
    args.hikSerialNo !== undefined &&
    args.hikSerialNo !== device.hikLastSerialNo
  ) {
    await ctx.db.patch(device._id, { hikLastSerialNo: args.hikSerialNo });
  }

  await ctx.db.insert("cardReadings", {
    projectId: projectForRow(employee?.projectId, device.projectId),
    deviceId: device._id,
    employeeId: employee?._id,
    cardNo: args.cardNo,
    employeeName: employee
      ? `${employee.firstName} ${employee.lastName}`
      : undefined,
    accessTime,
    accessStatus,
    direction,
    rawData: args.rawBody,
    ...hikFields,
    hikDenialReason: denialReason,
    createdAt: accessTime,
    updatedAt: accessTime,
  });
  return { granted };
}

async function persistIdeReading(
  ctx: MutationCtx,
  args: ProcessCardReadingArgs,
  device: Doc<"devices">,
  state: ReadingState,
): Promise<{ granted: boolean }> {
  const { accessTime, projectForRow, findDeviceCardEmployee } = state;
  // Erişim kararını PANEL verir; result kodu (1/2/3 = grant, kapı açılır) → ideResultGranted.
  const granted = ideResultGranted(args.ideResult);
  const accessStatus: "izin_verildi" | "reddedildi" = granted
    ? "izin_verildi"
    : "reddedildi";

  // Panel olay zamanı (payload.time, panel TZ = UTC+3) → UTC ISO. Offline kuyruktan
  // toplu push edilen event'lerde gerçek okutma anı korunur (sunucu alış anı değil).
  const ideAccessTime = ideTimeToISO(args.ideTime) ?? accessTime;

  const employee = await findDeviceCardEmployee(ctx, args.cardNo, device?.projectId);

  const direction = await resolveDirection(ctx, {
    device,
    employeeId: employee?._id ?? null,
    nowISO: ideAccessTime,
    ideIoId: args.ideIoId,
  });

  await ctx.db.insert("cardReadings", {
    projectId: projectForRow(employee?.projectId, device.projectId),
    deviceId: device._id,
    employeeId: employee?._id,
    cardNo: args.cardNo,
    employeeName: employee
      ? `${employee.firstName} ${employee.lastName}`
      : undefined,
    accessTime: ideAccessTime,
    accessStatus,
    direction,
    ideIoId: args.ideIoId,
    rawData: args.rawBody,
    createdAt: accessTime,
    updatedAt: accessTime,
  });
  return { granted };
}

async function consumeReaderToken(
  ctx: MutationCtx,
  args: ProcessCardReadingArgs,
  device: Doc<"devices"> | null,
): Promise<{ granted: boolean }> {
  const tokenRow = await ctx.db.query("checkInTokens")
    .withIndex("by_token", q => q.eq("token", args.cardNo)).first();
  const now = Date.now();
  if (!device || !tokenRow || tokenRow.purpose !== "reader" || tokenRow.usedAt ||
      !Number.isFinite(Date.parse(tokenRow.expiresAt)) || Date.parse(tokenRow.expiresAt) <= now) return { granted: false };
  const session = tokenRow.sessionId ? await ctx.db.get(tokenRow.sessionId) : null;
  if (!session || session.employeeId !== tokenRow.employeeId ||
      !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now ||
      (session.passwordVersion ?? 0) !== tokenRow.authVersion) return { granted: false };
  const tokenEmployee = await ctx.db.get(tokenRow.employeeId);
  if (!tokenEmployee || tokenRow.projectId !== tokenEmployee.projectId || tokenRow.projectId !== device.projectId) return { granted: false };
  const auth = await ctx.db.query("employeeAuth")
    .withIndex("by_employee", q => q.eq("employeeId", tokenEmployee._id)).first();
  if (!auth?.passwordHash || tokenRow.authVersion !== (auth.passwordVersion ?? 0) ||
      !(await genericReaderTokenAllowed(ctx, tokenEmployee, device, now))) return { granted: false };
  const consumedAt = new Date(now).toISOString();
  const employeeName = `${tokenEmployee.firstName} ${tokenEmployee.lastName}`;
  await ctx.db.patch(tokenRow._id, { usedAt: consumedAt, employeeName, locationRecorded: false });
  const direction = await resolveDirection(ctx, { device, employeeId: tokenEmployee._id, nowISO: consumedAt });
  await ctx.db.insert("cardReadings", {
    projectId: device.projectId, deviceId: device._id, employeeId: tokenEmployee._id,
    cardNo: tokenEmployee.cardNumber, employeeName, accessTime: consumedAt,
    accessStatus: "izin_verildi", direction, rawData: JSON.stringify({ source: "qr", protocol: "generic_reader" }),
    createdAt: consumedAt, updatedAt: consumedAt,
  });
  return { granted: true };
}

async function processGenericCardReading(
  ctx: MutationCtx,
  args: ProcessCardReadingArgs,
  device: Doc<"devices"> | null,
  state: ReadingState,
): Promise<{ granted: boolean }> {
  const { accessTime, projectForRow, hikFields, findDeviceCardEmployee } = state;
  // 2. Çalışanı kart numarasına göre bul
  // Projesiz legacy cihazlarda ilk kart eşleşmesi davranışı korunur.
  const employee = await findDeviceCardEmployee(ctx, args.cardNo, device?.projectId);

  if (!employee) {
    await ctx.db.insert("cardReadings", {
      projectId: projectForRow(undefined, device?.projectId),
      deviceId: device?._id,
      cardNo: args.cardNo,
      accessTime,
      accessStatus: "reddedildi",
      rawData: args.rawBody,
      ...hikFields,
      createdAt: accessTime,
      updatedAt: accessTime,
    });
    return { granted: false };
  }

  // Token yoluyla aynı kurallar: erişim penceresi + son çalışma günü (TR, dahil; işten çıkış
  // cron'u isActive'i kapatana kadarki boşlukta kart geçmesin) ve pasif cihaz reddi. Cihaz
  // yoksa da ret. Hepsi aynı ret satırını yazar.
  if (!employee.isActive || !employeeWithinAccessEpoch(employee, Date.parse(accessTime)) ||
      !device || device.isActive === false) {
    await ctx.db.insert("cardReadings", {
      projectId: projectForRow(employee.projectId, device?.projectId),
      deviceId: device?._id,
      employeeId: employee._id,
      cardNo: args.cardNo,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime,
      accessStatus: "reddedildi",
      rawData: args.rawBody,
      ...hikFields,
      createdAt: accessTime,
      updatedAt: accessTime,
    });
    return { granted: false };
  }

  // 3. Cihazın hiçbir grupta olup olmadığını kontrol et
  const deviceGroups = await ctx.db
    .query("groupDevices")
    .withIndex("by_project_device", (q) =>
      q.eq("projectId", device.projectId).eq("deviceId", device._id),
    )
    .collect();

  if (deviceGroups.length === 0) {
    const noGroupDirection = await resolveDirection(ctx, {
      device,
      employeeId: employee._id,
      nowISO: accessTime,
    });
    await ctx.db.insert("cardReadings", {
      projectId: projectForRow(employee.projectId, device.projectId),
      deviceId: device._id,
      employeeId: employee._id,
      cardNo: args.cardNo,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime,
      accessStatus: "reddedildi",
      direction: noGroupDirection,
      rawData: args.rawBody,
      ...hikFields,
      createdAt: accessTime,
      updatedAt: accessTime,
    });
    return { granted: false };
  }

  // 4. Çalışanın bu cihaza erişimi var mı? (groupMembers + accessRules)
  const deviceGroupIds = deviceGroups.map((gd) => gd.groupId);
  const { hasAccess, activeRuleIds } = await decideReadingAccess(ctx, employee, deviceGroupIds);

  // 5. Kayıt oluştur
  const cardDirection = await resolveDirection(ctx, {
    device,
    employeeId: employee._id,
    nowISO: accessTime,
  });
  await ctx.db.insert("cardReadings", {
    projectId: projectForRow(employee.projectId, device.projectId),
    deviceId: device._id,
    employeeId: employee._id,
    cardNo: args.cardNo,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    accessTime,
    accessStatus: hasAccess ? "izin_verildi" : "reddedildi",
    direction: cardDirection,
    rawData: args.rawBody,
    ...hikFields,
    ...(!hasAccess && activeRuleIds.size > 0 ? { hikDenialReason: "Zaman penceresi dışında" } : {}),
    createdAt: accessTime,
    updatedAt: accessTime,
  });

  // 6. Geç kalma bildirimi (hasAccess + geç giriş)
  if (hasAccess) {
    await notifyLateReading(ctx, employee, accessTime);
  }

  return { granted: hasAccess };
}

async function decideReadingAccess(
  ctx: MutationCtx,
  employee: Doc<"employees">,
  deviceGroupIds: Id<"accessRules">[],
) {
  const employeeAccessGroups = await ctx.db
    .query("groupMembers")
    .withIndex("by_project_employee", (q) =>
      q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
    )
    .collect();
  const employeeGroupIds = employeeAccessGroups.map((gm) => gm.groupId);
  const { activeRuleIds, openRuleIds } = await resolveActiveMatchingRuleIds(
    ctx,
    deviceGroupIds,
    employeeGroupIds,
    Date.now(),
  );
  const hasAccess = canEmployeeAccessDevice({
    deviceGroupIds,
    employeeGroupIds,
    activeRuleIds,
    openRuleIds,
  });

  return { hasAccess, activeRuleIds };
}

async function notifyLateReading(ctx: MutationCtx, employee: Doc<"employees">, accessTime: string) {
  const settings = await getEffectiveWorkSettings(ctx, employee.projectId);
  const dayShiftResolver = await buildShiftResolver(ctx, [employee]);
  const dayShift = dayShiftResolver.resolve(employee._id, trDateKey(accessTime));
  const { lateThresholdMin } = thresholdsForShift(dayShift, settings);
  const isLate = isoTimeToTRMinutes(accessTime) > lateThresholdMin;
  if (isLate && employee.projectId) {
    const projectId = employee.projectId;
    const notifSettings = await ctx.db
      .query("notificationSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    const generalSettings = await ctx.db
      .query("generalSettings")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    const notifyEmail = generalSettings?.email ?? process.env.NOTIFICATION_EMAIL;
    if (
      notifSettings?.lateNotifications !== false &&
      notifyEmail
    ) {
      ctx.scheduler.runAfter(0, internal.actions.sendEmail.sendLateNotification, {
        to: notifyEmail,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        lateTime: new Date(accessTime).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        projectId: employee.projectId,
      });
    }
  }
}
