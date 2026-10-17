import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authedQuery } from "./lib/customFunctions";
import { getEmployeeTargetDevices } from "./lib/peopleHikSnapshot";
import { resolveProjectScope } from "./lib/projectScope";
import {
  decideEmployeeDeviceStatuses,
  mergeRecentReadings,
  normalizeActivityCard,
  normalizeRecentReadingsLimit,
  PEOPLE_CARD_OWNER_SCAN_LIMIT,
  PEOPLE_DEVICE_LINK_LIMIT,
  PEOPLE_MEMBERSHIP_LIMIT,
  PEOPLE_OPERATION_SCAN_LIMIT,
  uniqueEmployeeCard,
  type EmployeeActivityOperation,
} from "./lib/peopleActivity";

async function scopedEmployee(ctx: QueryCtx, employeeId: Id<"employees">) {
  const employee = await ctx.db.get(employeeId);
  if (!employee) return null;
  const allowed = await resolveProjectScope(ctx);
  const projectId = employee.projectId;
  if (!projectId || !allowed.includes(projectId)) {
    throw new ConvexError("Bu personele erişim yetkiniz yok");
  }
  return { employee, projectId };
}

export const employeeSyncStatus = authedQuery({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, { employeeId }) => {
    const scope = await scopedEmployee(ctx, employeeId);
    if (!scope) return null;
    const { employee, projectId } = scope;
    const targets = await getEmployeeTargetDevices(ctx, employee, {
      membershipLimit: PEOPLE_MEMBERSHIP_LIMIT,
      linkLimit: PEOPLE_DEVICE_LINK_LIMIT,
      activeOnly: true,
    });
    const hasHik = targets.devices.some(device => device.brand === "hikvision");
    const hasIde = targets.devices.some(device => device.brand === "ide_smart");
    const hikStatuses = ["pending", "processing", "failed", "done"] as const;
    const ideStatuses = ["pending", "sent", "failed", "acked"] as const;
    const [hikBatches, ideBatches, cardOwners] = await Promise.all([
      Promise.all((hasHik ? hikStatuses : []).map(status => ctx.db.query("hikPendingOperations")
        .withIndex("by_project_status_created", q => q.eq("projectId", projectId).eq("status", status))
        .order("desc").take(PEOPLE_OPERATION_SCAN_LIMIT))),
      Promise.all((hasIde ? ideStatuses : []).map(status => ctx.db.query("idePendingOperations")
        .withIndex("by_project_status_created", q => q.eq("projectId", projectId).eq("status", status))
        .order("desc").take(PEOPLE_OPERATION_SCAN_LIMIT))),
      hasIde && normalizeActivityCard(employee.cardNumber)
        ? ctx.db.query("employees").withIndex("by_project", q => q.eq("projectId", projectId))
          .take(PEOPLE_CARD_OWNER_SCAN_LIMIT)
        : Promise.resolve([]),
    ]);
    const cardOwnersTruncated = cardOwners.length === PEOPLE_CARD_OWNER_SCAN_LIMIT;
    const cardNumber = uniqueEmployeeCard(cardOwners, employeeId, cardOwnersTruncated);
    const roster = cardNumber ? (await Promise.all(targets.devices.map(async device => {
      const ideUuid = device.ideUuid;
      if (device.brand !== "ide_smart" || !ideUuid) return null;
      const entries = await ctx.db.query("idePanelUsers")
        .withIndex("by_uuid_card", q => q.eq("ideUuid", ideUuid).eq("cardNumber", cardNumber))
        .take(2);
      const entry = entries[0];
      if (entries.length !== 1 || !entry || entry.projectId !== projectId || entry.deviceId !== device._id) return null;
      // Bu tablo markAck(success) veya cihazdan okunan seedPanelUsers ile yazılır.
      return { deviceId: device._id, syncedAt: entry.syncedAt };
    }))).filter((row): row is NonNullable<typeof row> => row !== null) : [];
    const truncated = {
      hikvision: hikBatches.some(rows => rows.length === PEOPLE_OPERATION_SCAN_LIMIT),
      ide_smart: ideBatches.some(rows => rows.length === PEOPLE_OPERATION_SCAN_LIMIT) || cardOwnersTruncated,
    };
    const operations: EmployeeActivityOperation[] = [
      ...hikBatches.flat().map(op => ({ ...op, source: "hikvision" as const })),
      ...ideBatches.flat().map(op => ({ ...op, source: "ide_smart" as const })),
    ];
    const result = decideEmployeeDeviceStatuses(targets.devices.map(device => ({
      id: device._id, name: device.name, brand: device.brand ?? null,
    })), employeeId, operations, truncated, {
      cardNumber, employeeCreatedAt: employee._creationTime, roster,
    });
    return {
      ...result,
      scanTruncated: truncated.hikvision || truncated.ide_smart,
      targetsTruncated: targets.truncated,
    };
  },
});

export const employeeRecentReadings = authedQuery({
  args: { employeeId: v.id("employees"), limit: v.optional(v.number()) },
  handler: async (ctx, { employeeId, limit: requestedLimit }) => {
    const scope = await scopedEmployee(ctx, employeeId);
    if (!scope) return null;
    const limit = normalizeRecentReadingsLimit(requestedLimit);
    // Eski durum-alanı boş okumaları da erişim geçmişinde tut; biyometri süzmesi yok.
    const statuses: Doc<"cardReadings">["accessStatus"][] = ["izin_verildi", "reddedildi", undefined];
    const batches = await Promise.all(statuses.map(status => ctx.db.query("cardReadings")
      .withIndex("by_employee_status_time", q => q.eq("employeeId", employeeId).eq("accessStatus", status))
      .order("desc").take(limit)));
    const readings = mergeRecentReadings(batches, scope.projectId, limit);
    const deviceIds = [...new Set(readings.flatMap(row => row.deviceId ? [row.deviceId] : []))];
    const devices = await Promise.all(deviceIds.map(id => ctx.db.get(id)));
    const deviceNames = new Map(devices
      .filter((device): device is NonNullable<typeof device> => device !== null)
      .filter(device => device.projectId === scope.projectId)
      .map(device => [device._id, device.name]));
    return readings.map(row => ({
      _id: row._id,
      accessTime: row.accessTime,
      accessStatus: row.accessStatus ?? null,
      direction: row.direction ?? null,
      deviceId: row.deviceId ?? null,
      deviceName: row.deviceId ? deviceNames.get(row.deviceId) ?? null : null,
      hikDenialReason: row.hikDenialReason ?? null,
    }));
  },
});
