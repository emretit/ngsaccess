import type { Id } from "../_generated/dataModel";
import { auditIndex } from "./auditLogQuery";

export const AUDIT_ACTOR_SCAN_LIMIT = 2000;
export type AuditActorStatus = "active" | "member" | "deleted" | "removed";
export interface AuditActorOption {
  userId: Id<"users">;
  label: string;
  status: AuditActorStatus;
  lastSeenAt?: number;
}

/** System must outrank action/table filters so absent userId is index-bounded. */
export function auditActorIndex(
  projectId?: string, targetTable?: string, userId?: string, action?: string, actor?: "system",
) {
  if (actor && userId) throw new Error("Sistem ve kullanıcı filtresi birlikte kullanılamaz");
  return actor
    ? projectId ? "by_project_user_timestamp" : "by_user_timestamp"
    : auditIndex(projectId, targetTable, userId, action);
}

export function maskAuditEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

function safeLabel(value: string): string {
  return value.replace(/[^\s<>@]+@[^\s<>@]+/g, maskAuditEmail);
}

interface ActorEvent { userId?: Id<"users">; userName?: string; timestamp: number }
interface ActorUser { _id: Id<"users">; fullName?: string; name?: string; email?: string }

/** Pure merge; current names take precedence, historical snapshots stay available. */
export function mergeAuditActors(args: {
  events: ReadonlyArray<ActorEvent>;
  users: ReadonlyArray<ActorUser>;
  memberIds: ReadonlyArray<Id<"users">>;
  callerId: Id<"users">;
  allProjects?: boolean;
  membershipComplete?: boolean;
  search?: string;
}): { actors: AuditActorOption[]; includesSystem: boolean } {
  const snapshots = new Map<Id<"users">, { timestamp: number; userName?: string; snapshotAt?: number }>();
  let includesSystem = false;
  for (const event of args.events) {
    if (event.userId === undefined) { includesSystem = true; continue; }
    const previous = snapshots.get(event.userId);
    const next = previous ?? { timestamp: event.timestamp };
    next.timestamp = Math.max(next.timestamp, event.timestamp);
    if (event.userName?.trim() && (next.snapshotAt === undefined || next.snapshotAt < event.timestamp)) {
      next.userName = event.userName;
      next.snapshotAt = event.timestamp;
    }
    snapshots.set(event.userId, next);
  }
  const users = new Map(args.users.map(user => [user._id, user]));
  const members = new Set([...args.memberIds, args.callerId]);
  const ids = new Set([...snapshots.keys(), ...members]);
  const actors: AuditActorOption[] = [...ids].sort().map(userId => {
    const user = users.get(userId);
    const event = snapshots.get(userId);
    const label = safeLabel(user?.fullName?.trim() || user?.name?.trim() || event?.userName?.trim() || "Silinmiş kullanıcı");
    const status: AuditActorStatus = !user ? "deleted"
      : !args.allProjects && args.membershipComplete !== false && !members.has(userId) ? "removed"
      : event ? "active" : "member";
    return { userId, label, status, ...(event ? { lastSeenAt: event.timestamp } : {}) };
  });
  const counts = new Map<string, number>();
  for (const actor of actors) {
    const key = actor.label.toLocaleLowerCase("tr-TR");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const used = new Set<string>();
  for (const [index, actor] of actors.entries()) {
    const key = actor.label.toLocaleLowerCase("tr-TR");
    if ((counts.get(key) ?? 0) > 1) {
      const email = users.get(actor.userId)?.email;
      actor.label += ` (${email ? `${maskAuditEmail(email)} · ` : ""}Aktör ${index + 1})`;
    }
    while (used.has(actor.label.toLocaleLowerCase("tr-TR"))) actor.label += ` · ${index + 1}`;
    used.add(actor.label.toLocaleLowerCase("tr-TR"));
  }
  const search = args.search?.trim().toLocaleLowerCase("tr-TR");
  return {
    actors: actors.filter(actor => !search || actor.label.toLocaleLowerCase("tr-TR").includes(search))
      .sort((a, b) => a.label.localeCompare(b.label, "tr-TR")),
    includesSystem,
  };
}
