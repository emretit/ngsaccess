import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Ortak üyelik → cihaz/kapı yolu; UI okuyucularının mevcut okuma bütçesi korunur. */
export async function getEmployeeTargetDevices(
  ctx: Pick<QueryCtx, "db">,
  employee: Doc<"employees">,
  options?: { membershipLimit: number; linkLimit: number; activeOnly?: boolean },
) {
  const membershipQuery = ctx.db.query("groupMembers").withIndex("by_project_employee", q =>
    q.eq("projectId", employee.projectId).eq("employeeId", employee._id),
  );
  const memberships = options
    ? await membershipQuery.take(options.membershipLimit)
    : await membershipQuery.take(4097);
  if (!options && memberships.length > 4096) throw new Error("Kişi kural sınırı aşıldı");
  let truncated = options !== undefined && memberships.length === options.membershipLimit;
  const budget = options ? { remaining: options.linkLimit, truncated: false } : undefined;
  const devices = new Map<string, Doc<"devices">>();
  const seenRules = new Set<string>();
  for (const membership of memberships) {
    if (seenRules.has(membership.groupId)) continue;
    seenRules.add(membership.groupId);
    if (budget?.remaining === 0) { truncated = true; break; }
    const rule = await ctx.db.get(membership.groupId);
    if (!rule || rule.projectId !== employee.projectId) continue;
    if (options?.activeOnly && !rule.isActive) continue;
    const targets = await resolveRuleDeviceTargets(ctx, rule, options?.activeOnly ?? false, budget);
    for (const { device } of targets) devices.set(device._id, device);
  }
  return { devices: [...devices.values()], truncated: truncated || budget?.truncated === true };
}

/** Kayıt silinmeden cihaz hedeflerini dondurur; action silinen kaydı tekrar okumaz. */
export async function snapshotEmployeeHikDevices(ctx: Pick<QueryCtx, "db">, employee: Doc<"employees">) {
  const { devices } = await getEmployeeTargetDevices(ctx, employee);
  // Applied/pending history survives relationship removal. Never cross project boundaries.
  const projectId = employee.projectId;
  const grants = projectId ? await ctx.db.query("accessGrantStatus").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", employee._id)).take(4097) : [];
  if (grants.length > 4096) throw new Error("Kişi cihaz geçmişi sınırı aşıldı");
  const known = new Set(devices.map(device => device._id));
  for (const grant of grants) {
    if (grant.state === "removed" || known.has(grant.deviceId)) continue;
    const device = await ctx.db.get(grant.deviceId);
    if (device?.projectId !== employee.projectId || !device) continue;
    devices.push(device); known.add(device._id);
  }
  return {
    cardNumber: employee.cardNumber,
    projectId: employee.projectId,
    devices: devices.filter(device => device.brand === "hikvision").map(device => ({
      _id: device._id, name: device.name, brand: device.brand,
      projectId: device.projectId, hikDevIndex: device.hikDevIndex,
      hikTransport: device.hikTransport, hikDoorCount: device.hikDoorCount,
    })),
  };
}

export const hikSnapshotValidator = v.object({
  cardNumber: v.string(), projectId: v.optional(v.id("projects")),
  devices: v.array(v.object({
    _id: v.id("devices"), name: v.string(),
    brand: v.optional(v.union(v.literal("hikvision"), v.literal("other"), v.literal("ide_smart"))),
    projectId: v.optional(v.id("projects")), hikDevIndex: v.optional(v.string()),
    hikTransport: v.optional(v.union(v.literal("gateway"), v.literal("localBridge"))), hikDoorCount: v.optional(v.number()),
  })),
});

export type HikSnapshot = Infer<typeof hikSnapshotValidator>;

/** Match buildDoorPlans' usable doors and the bridge's single-plan payload. */
export async function hasWritableHikCredential(ctx: Pick<QueryCtx, "db">, employee: Doc<"employees">, device: Doc<"devices">) {
  if (!device.isActive || device.brand !== "hikvision" || employee.isActive === false || employee.projectId !== device.projectId) return false;
  if (device.hikTransport !== "localBridge" && !device.hikDevIndex) return false;
  const members = await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", employee.projectId).eq("employeeId", employee._id)).take(4097);
  if (members.length > 4096) throw new Error("Kişi kural sınırı aşıldı");
  const plans = new Set<string>();
  const count = Math.max(1, device.hikDoorCount ?? (device.hikTransport === "localBridge" ? 4 : 1));
  for (const member of members) {
    const rule = await ctx.db.get(member.groupId);
    if (!rule?.isActive || rule.projectId !== employee.projectId) continue;
    const target = (await resolveRuleDeviceTargets(ctx, rule)).find(target => target.device._id === device._id);
    if (!target || (target.doorNos !== undefined && !target.doorNos.some(no => Number.isInteger(no) && no >= 1 && no <= count))) continue;
    if (rule.hikWeekPlanNo !== undefined && (!Number.isInteger(rule.hikWeekPlanNo) || rule.hikWeekPlanNo < 1)) return false;
    // Unallocated rules receive distinct plan numbers on the addition path.
    plans.add(rule.hikWeekPlanNo === undefined ? `rule:${rule._id}` : `plan:${rule.hikWeekPlanNo}`);
  }
  return plans.size > 0 && (device.hikTransport !== "localBridge" || plans.size === 1);
}

/** Capture before changing relationships; reconcile against the committed new graph. */
export async function planRemovedEmployeeHik(ctx: Pick<QueryCtx, "db">, employeeId: Id<"employees">, snapshot: HikSnapshot) {
  const employee = await ctx.db.get(employeeId);
  if (!employee || employee.projectId !== snapshot.projectId) return { snapshot, remaining: [] };
  const remaining = new Set<Id<"devices">>();
  if (employee.isActive !== false) {
    const memberships = await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", employee.projectId).eq("employeeId", employeeId)).take(4097);
    if (memberships.length > 4096) throw new Error("Kişi kural sınırı aşıldı");
    for (const member of memberships) {
      const rule = await ctx.db.get(member.groupId);
      if (!rule?.isActive || rule.projectId !== employee.projectId) continue;
      for (const { device, doorNos } of await resolveRuleDeviceTargets(ctx, rule)) {
        if (device.brand !== "hikvision") continue;
        const count = Math.max(1, device.hikDoorCount ?? (device.hikTransport === "localBridge" ? 4 : 1));
        if (doorNos === undefined || doorNos.some(no => Number.isInteger(no) && no >= 1 && no <= count)) remaining.add(device._id);
      }
    }
  }
  // Deferred batches may see a newly assigned card. Its rights never preserve
  // the old credential captured by the original removal transaction.
  const devices = employee.cardNumber !== snapshot.cardNumber ? snapshot.devices
    : snapshot.devices.filter(device => !remaining.has(device._id));
  return { snapshot: { ...snapshot, devices }, remaining: [...remaining].filter(id => snapshot.devices.some(device => device._id === id)) };
}

export async function reconcileRemovedEmployeeHik(ctx: MutationCtx, employeeId: Id<"employees">, snapshot: HikSnapshot) {
  const plan = await planRemovedEmployeeHik(ctx, employeeId, snapshot);
  if (!plan) return;
  if (plan.snapshot.devices.length) await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.deleteEmployeeFromDevicesInternal, { employeeId, snapshot: plan.snapshot });
  if (plan.remaining.length) await ctx.scheduler.runAfter(0, internal.actions.hikvisionSync.syncEmployeeToDevicesInternal, { employeeId, targetDeviceIds: plan.remaining });
}

export async function snapshotRuleHikEmployees(ctx: MutationCtx, employeeIds: Id<"employees">[], projectId: Id<"projects"> | undefined, devices?: HikSnapshot["devices"]) {
  const snapshots = new Map<Id<"employees">, HikSnapshot>();
  for (const id of new Set(employeeIds)) {
    const employee = await ctx.db.get(id);
    if (employee && employee.projectId === projectId) snapshots.set(id, devices ? { cardNumber: employee.cardNumber, projectId, devices } : await snapshotEmployeeHikDevices(ctx, employee));
  }
  return snapshots;
}

/** Shared Hik scope: device links plus live door links; stale door snapshots only
 * produce empty scopes, never grant all-door access. Revocations include inactive devices. */
export async function resolveRuleDeviceTargets(
  ctx: Pick<QueryCtx, "db">,
  rule: Doc<"accessRules">,
  activeOnly = true,
  budget?: { remaining: number; truncated: boolean },
): Promise<{ device: Doc<"devices">; doorNos?: number[] }[]> {
  const readLinks = async <T>(query: { take: (limit: number) => Promise<T[]> }): Promise<T[]> => {
    const limit = Math.min(4096, budget?.remaining ?? 4096);
    const rows = await query.take(limit + 1);
    if (!budget && rows.length > limit) throw new Error("Kural cihaz sınırı aşıldı");
    if (budget) { budget.truncated ||= rows.length > limit; budget.remaining -= Math.min(rows.length, limit); }
    return rows.slice(0, limit);
  };
  const links = await readLinks(ctx.db.query("groupDevices").withIndex("by_project_group", q => q.eq("projectId", rule.projectId).eq("groupId", rule._id)));
  const selections = await readLinks(ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)));
  const byDevice = new Map<Id<"devices">, number[] | undefined>(links.map(link => [link.deviceId, undefined]));
  const selected = new Map<Id<"devices">, number[]>();
  for (const link of selections) {
    const door = await ctx.db.get(link.doorId);
    if (link.deviceId && link.deviceId !== door?.deviceId && !selected.has(link.deviceId)) selected.set(link.deviceId, []);
    if (!door?.deviceId) continue;
    const numbers = selected.get(door.deviceId) ?? [];
    if (door.projectId === rule.projectId) numbers.push(door.hikDoorNo ?? 0);
    selected.set(door.deviceId, numbers);
  }
  for (const [id, numbers] of selected) byDevice.set(id, numbers);
  const result: { device: Doc<"devices">; doorNos?: number[] }[] = [];
  for (const [id, doorNos] of byDevice) {
    const device = await ctx.db.get(id);
    if (!device || device.projectId !== rule.projectId || (activeOnly && !device.isActive)) continue;
    if (device.brand !== "hikvision" && !links.some(link => link.deviceId === id)) continue;
    result.push({ device, ...(device.brand === "hikvision" && doorNos !== undefined ? { doorNos } : {}) });
  }
  return result;
}
