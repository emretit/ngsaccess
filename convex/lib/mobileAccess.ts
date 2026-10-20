import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { accessScheduleError } from "./accessRuleUx";

const GRAPH_LIMIT = 500;
export type MobileTransport = "ide_mqtt" | "hik_local_bridge" | "hik_gateway" | "unsupported";
export type MobileTarget = {
  _id: Id<"devices">;
  deviceId: Id<"devices">;
  doorId?: Id<"doors">;
  targetId: string;
  name: string;
  deviceSerial: string | null;
  deviceType: string | null;
  zoneName: string | null;
  doorName: string | null;
  transport: MobileTransport;
  canOpen: boolean;
  reason: string | null;
  supportsReaderToken: boolean;
  actuator: number | null;
};

export function accessError(code: string) {
  return new ConvexError({ code, message: code });
}

/** Legacy overnight/malformed schedules fail closed, matching the write validator. */
export function mobileRuleAllows(rule: Doc<"accessRules">, now: number): boolean {
  if (rule.isActive === false || accessScheduleError(rule)) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Istanbul", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(now));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value;
  if (!rule.days?.includes(part("weekday") ?? "")) return false;
  if (!rule.startTime && !rule.endTime) return true;
  const time = `${part("hour")}:${part("minute")}`;
  return Boolean(rule.startTime && rule.endTime && time >= rule.startTime && time < rule.endTime);
}

export function employeeWithinAccessEpoch(employee: Doc<"employees">, now: number): boolean {
  if (employee.isActive === false) return false;
  const start = employee.accessStartsAt === undefined ? -Infinity : Date.parse(employee.accessStartsAt);
  const end = employee.accessExpiresAt === undefined ? Infinity : Date.parse(employee.accessExpiresAt);
  return !Number.isNaN(start) && !Number.isNaN(end) && now >= start && now < end;
}

function bounded<T>(rows: T[]): T[] {
  if (rows.length > GRAPH_LIMIT) throw accessError("ACCESS_GRAPH_LIMIT");
  return rows;
}

function transportOf(device: Doc<"devices">): MobileTransport {
  // Operator attestation only after isolated per-panel credentials, topic ACLs,
  // TLS and compatible firmware have been verified on the deployed fleet.
  if (device.brand === "ide_smart" && device.ideUuid && process.env.MOBILE_IDE_ISOLATION_VERIFIED === "true") return "ide_mqtt";
  if (device.brand === "hikvision") {
    // The repository Windows consumer still uses the removed roster protocol.
    // Keep mobile opens disabled until a compatible poll consumer is delivered.
    if (device.hikTransport === "localBridge") return "unsupported";
    if (device.hikDevIndex) return "hik_gateway";
  }
  return "unsupported";
}

/** Shared tenant, graph, topology and time policy for discovery and execution. */
export async function listMobileTargets(ctx: QueryCtx, employee: Doc<"employees">, now = Date.now()): Promise<MobileTarget[]> {
  const projectId = employee.projectId;
  if (!projectId) return [];
  const project = await ctx.db.get(projectId);
  if (!project || project.isActive === false) return [];
  const memberships: Doc<"groupMembers">[] = bounded<Doc<"groupMembers">>(await ctx.db.query("groupMembers")
    .withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", employee._id)).take(GRAPH_LIMIT + 1));
  const grants = new Map<Id<"devices">, Array<{ rule: Doc<"accessRules">; doors: Set<Id<"doors">> | null }>>();
  for (const groupId of new Set(memberships.map(value => value.groupId))) {
    const rule = await ctx.db.get(groupId);
    if (!rule || rule.projectId !== projectId) continue;
    const deviceLinks: Doc<"groupDevices">[] = bounded<Doc<"groupDevices">>(await ctx.db.query("groupDevices")
      .withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", groupId)).take(GRAPH_LIMIT + 1));
    const doorLinks: Doc<"groupDoors">[] = bounded<Doc<"groupDoors">>(await ctx.db.query("groupDoors")
      .withIndex("by_project_group", q => q.eq("projectId", projectId).eq("groupId", groupId)).take(GRAPH_LIMIT + 1));
    let invalidDoorLink = false;
    const doorsByDevice = new Map<Id<"devices">, Set<Id<"doors">>>();
    for (const link of doorLinks) {
      const door = await ctx.db.get(link.doorId);
      if (!door || door.projectId !== projectId || !door.deviceId || (link.deviceId && link.deviceId !== door.deviceId)) {
        invalidDoorLink = true;
        continue;
      }
      const ids = doorsByDevice.get(door.deviceId) ?? new Set<Id<"doors">>();
      ids.add(door._id);
      doorsByDevice.set(door.deviceId, ids);
    }
    if (invalidDoorLink) continue;
    const devices = new Set([...deviceLinks.map(link => link.deviceId), ...doorsByDevice.keys()]);
    for (const deviceId of devices) {
      const device = await ctx.db.get(deviceId);
      if (!device || device.projectId !== projectId) continue;
      // Explicit per-panel doors narrow a blanket groupDevices grant.
      // Invalid door links never fall back to blanket permission.
      const hasDoorRestriction = doorLinks.some(link => link.deviceId === deviceId) || doorsByDevice.has(deviceId);
      const restricted = hasDoorRestriction ? doorsByDevice.get(deviceId) ?? new Set<Id<"doors">>() : null;
      const entries = grants.get(deviceId) ?? [];
      entries.push({ rule, doors: restricted });
      grants.set(deviceId, entries);
    }
  }
  const result: MobileTarget[] = [];
  for (const [deviceId, entries] of grants) {
    const device = await ctx.db.get(deviceId);
    if (!device || device.projectId !== projectId) continue;
    const linkedDoors: Doc<"doors">[] = bounded<Doc<"doors">>(await ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", deviceId)).take(GRAPH_LIMIT + 1));
    // A malformed legacy pointer cannot silently select a default actuator.
    const legacyDoor = device.doorId ? await ctx.db.get(device.doorId) : null;
    if (device.doorId && (!legacyDoor || legacyDoor.projectId !== projectId || legacyDoor.deviceId !== deviceId)) continue;
    if (linkedDoors.some(door => door.projectId !== projectId)) continue;
    const allDoors = linkedDoors;
    const count = device.brand === "ide_smart" ? device.ideDoorCount ?? device.doorCount ?? 4
      : device.hikDoorCount ?? device.doorCount ?? 1;
    const transport = transportOf(device);
    const zone = device.zoneId ? await ctx.db.get(device.zoneId) : null;
    for (const door of allDoors.length ? allDoors : [undefined]) {
      const applicable = entries.filter(entry => entry.doors === null || (door && entry.doors.has(door._id)));
      if (!applicable.length) continue;
      const actuator = device.brand === "ide_smart" ? door?.ioId : door?.hikDoorNo ?? (count === 1 ? 1 : undefined);
      const validSlot = actuator !== undefined && Number.isInteger(actuator) && Number.isInteger(count) && count >= 1 && count <= 8
        && actuator >= (device.brand === "ide_smart" ? 0 : 1) && actuator < count + (device.brand === "ide_smart" ? 0 : 1);
      const duplicateSlot = allDoors.filter(other => device.brand === "ide_smart" ? other.ioId === actuator : (other.hikDoorNo ?? (count === 1 ? 1 : undefined)) === actuator).length > 1;
      const reason = device.isActive === false ? "DEVICE_INACTIVE"
        : door?.status && door.status !== "active" ? "DOOR_INACTIVE"
        : !employeeWithinAccessEpoch(employee, now) ? "ACCESS_EPOCH_DENIED"
        : !applicable.some(entry => mobileRuleAllows(entry.rule, now)) ? "SCHEDULE_DENIED"
        : !validSlot || duplicateSlot || (!door && count !== 1) ? "TARGET_UNSUPPORTED"
        : transport === "unsupported" ? "TRANSPORT_UNSUPPORTED" : null;
      result.push({
        _id: deviceId, deviceId, ...(door ? { doorId: door._id } : {}),
        targetId: `${deviceId}:${door?._id ?? "standalone"}`, name: device.name,
        deviceSerial: device.deviceSerial ?? null, deviceType: device.deviceType ?? null,
        zoneName: zone?.projectId === projectId ? zone.name : null, doorName: door?.name ?? null,
        transport, canOpen: reason === null, reason, supportsReaderToken: device.brand !== "ide_smart" && device.brand !== "hikvision",
        actuator: validSlot && !duplicateSlot && (door || count === 1) ? actuator ?? null : null,
      });
      if (result.length > GRAPH_LIMIT) throw accessError("ACCESS_GRAPH_LIMIT");
    }
  }
  return result;
}

export async function resolveMobileTarget(ctx: QueryCtx, employee: Doc<"employees">, deviceId: Id<"devices">, doorId?: Id<"doors">) {
  const targets = (await listMobileTargets(ctx, employee)).filter(target => target.deviceId === deviceId);
  const target = doorId ? targets.find(value => value.doorId === doorId) : targets.length === 1 ? targets[0] : undefined;
  if (!target) throw accessError("TARGET_NOT_ALLOWED");
  if (!target.canOpen) throw accessError(target.reason ?? "TARGET_NOT_ALLOWED");
  if (target.actuator === null) throw accessError("TARGET_UNSUPPORTED");
  return { ...target, actuator: target.actuator };
}

/** Reader UUIDs are supported only by authenticated generic readers, never mapped to IDE/Hik card numbers. */
export async function genericReaderTokenAllowed(ctx: QueryCtx, employee: Doc<"employees">, device: Doc<"devices">, now: number): Promise<boolean> {
  if (!employee.projectId || employee.projectId !== device.projectId || device.isActive === false || !employeeWithinAccessEpoch(employee, now)) return false;
  if (device.brand === "ide_smart" || device.brand === "hikvision") return false;
  const targets = await listMobileTargets(ctx, employee, now);
  // Generic protocol carries no actuator: ambiguous multi-door authorization fails closed.
  const own = targets.filter(target => target.deviceId === device._id);
  return own.length === 1 && own[0].actuator === 1 && (own[0].reason === "TRANSPORT_UNSUPPORTED" || own[0].canOpen);
}

export const MOBILE_COMMAND_TTL_MS = 30_000;

export function mobileOperationId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null || !("mobileOperationId" in payload)) return undefined;
  return typeof payload.mobileOperationId === "string" ? payload.mobileOperationId : "invalid";
}

/** Authorization is re-evaluated just before irreversible delivery, including logout/revocation. */
export async function mobileOperationAllowed(ctx: QueryCtx, row: Doc<"mobileAccessOperations">): Promise<boolean> {
  const now = Date.now();
  const requestedAt = Date.parse(row.requestedAt);
  if (row.status !== "pending" || !Number.isFinite(requestedAt) || now < requestedAt || now - requestedAt >= MOBILE_COMMAND_TTL_MS) return false;
  const [employee, session] = await Promise.all([ctx.db.get(row.employeeId), ctx.db.get(row.sessionId)]);
  if (!employee || employee.projectId !== row.projectId || !session || session.employeeId !== employee._id ||
      !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now || (session.passwordVersion ?? 0) !== row.authVersion) return false;
  const auth = await ctx.db.query("employeeAuth").withIndex("by_employee", q => q.eq("employeeId", employee._id)).first();
  if (!auth?.passwordHash || (auth.passwordVersion ?? 0) !== row.authVersion) return false;
  try {
    const target = await resolveMobileTarget(ctx, employee, row.deviceId, row.doorId);
    return target.transport === row.transport && target.actuator === row.actuator;
  } catch {
    return false;
  }
}

export async function mobileQueueAllowed(ctx: QueryCtx, command: Doc<"idePendingOperations"> | Doc<"hikPendingOperations">): Promise<boolean> {
  const marker = mobileOperationId(command.payload);
  if (marker === undefined) return true;
  const id = ctx.db.normalizeId("mobileAccessOperations", marker);
  const row = id ? await ctx.db.get(id) : null;
  if (!row || row.deviceId !== command.deviceId || row.projectId !== command.projectId ||
      (row.ideOperationId !== command._id && row.hikOperationId !== command._id)) return false;
  return await mobileOperationAllowed(ctx, row);
}
