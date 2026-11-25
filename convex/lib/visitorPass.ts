import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { resolveDirection } from "./cardReadingProcess";
import { visitorTime } from "./visitorStatus";
import { scheduleVisitorCardRemoval } from "../visitors";
import { isVirtualReader } from "./virtualReader";

export const VISITOR_TOKEN_PATTERN = /^NGSV1\.[A-Za-z0-9_-]{22}$/;
export const PIN_PATTERN = /^\d{6}$/;
const WINDOW_MS = 5 * 60_000;

export async function hashVisitorSecret(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function generateVisitorToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `NGSV1.${btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export function generateVisitorPin(): string {
  // Rejection sampling avoids modulo bias in the six-digit namespace.
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= 4_294_000_000);
  return String(value % 1_000_000).padStart(6, "0");
}

export async function generateVisitorCard(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    if (!value) continue;
    const card = String(value);
    if (!await ctx.db.query("employees").withIndex("by_card", q => q.eq("cardNumber", card)).first()) return card;
  }
  throw new Error("Sanal kart numarası üretilemedi; yeniden deneyin");
}

export type VisitorPassDenial = "TOKEN_INVALID" | "READER_INACTIVE" | "PIN_LOCKED" | "NOT_ALLOWED" | "NOT_ACTIVE" | "NOT_STARTED" | "EXPIRED" | "REVOKED" | "EXHAUSTED";
export type VisitorPassOutcome = { status: "denied"; reason: VisitorPassDenial } | {
  status: "granted"; employeeName: string; direction: "entry" | "exit"; accessTime: string;
  visitorPassId: Id<"visitorPasses">; visitorId: Id<"employees">; projectId: Id<"projects">; doorId: Id<"doors"> | null;
};

/** Caller authenticates the virtual reader; every decision and write stays in its transaction. */
export async function consumeVisitorPass(
  ctx: MutationCtx, device: Doc<"devices">, input: { source: "qr" | "pin"; code: string },
): Promise<VisitorPassOutcome> {
  const now = Date.now();
  const accessTime = new Date(now).toISOString();
  let pass: Doc<"visitorPasses"> | null = null;
  let visitor: Doc<"employees"> | null = null;
  const deny = async (reason: VisitorPassDenial): Promise<VisitorPassOutcome> => {
    const local = pass?.projectId === device.projectId;
    await ctx.db.insert("cardReadings", {
      projectId: device.projectId, deviceId: device._id,
      employeeId: local ? visitor?._id : undefined, cardNo: "",
      employeeName: local && visitor ? `${visitor.firstName} ${visitor.lastName}` : undefined,
      accessTime, accessStatus: "reddedildi", createdAt: accessTime, updatedAt: accessTime,
      rawData: JSON.stringify({ source: input.source, protocol: "visitor_pass", passId: local ? pass?._id ?? null : null, reason }),
    });
    return { status: "denied", reason };
  };
  if (device.isActive === false) return deny("READER_INACTIVE");
  if (!device.projectId) return deny("NOT_ALLOWED");
  const projectId = device.projectId;
  if (input.source === "pin") {
    const attempt = await ctx.db.query("visitorPassAttempts").withIndex("by_deviceId", q => q.eq("deviceId", device._id)).unique();
    // The fifth failure already wrote the one lock event for this window.
    if (attempt?.lockedUntil && attempt.lockedUntil > now) return { status: "denied", reason: "PIN_LOCKED" };
    if (PIN_PATTERN.test(input.code)) {
      const hash = await hashVisitorSecret(`${projectId}:${input.code}`);
      pass = await ctx.db.query("visitorPasses").withIndex("by_projectId_and_pinHash_and_status", q => q.eq("projectId", projectId).eq("pinHash", hash).eq("status", "active")).unique()
        ?? await ctx.db.query("visitorPasses").withIndex("by_projectId_and_pinHash_and_status", q => q.eq("projectId", projectId).eq("pinHash", hash).eq("status", "exhausted")).unique()
        ?? await ctx.db.query("visitorPasses").withIndex("by_projectId_and_pinHash", q => q.eq("projectId", projectId).eq("pinHash", hash)).first();
    }
    if (!pass) {
      const fresh = !attempt || now - attempt.windowStart >= WINDOW_MS;
      const failures = fresh ? 1 : attempt.failures + 1;
      const values = { windowStart: fresh ? now : attempt.windowStart, failures, lockedUntil: failures >= 5 ? now + WINDOW_MS : undefined };
      if (attempt) await ctx.db.patch(attempt._id, values);
      else await ctx.db.insert("visitorPassAttempts", { deviceId: device._id, ...values });
      return deny(failures >= 5 ? "PIN_LOCKED" : "TOKEN_INVALID");
    }
    // Successful guesses do not erase failures within the five-minute window.
  } else {
    if (!VISITOR_TOKEN_PATTERN.test(input.code)) return deny("TOKEN_INVALID");
    const hash = await hashVisitorSecret(input.code);
    pass = await ctx.db.query("visitorPasses").withIndex("by_tokenHash", q => q.eq("tokenHash", hash)).unique();
  }
  if (!pass) return deny("TOKEN_INVALID");
  if (pass.projectId !== device.projectId) return deny("NOT_ALLOWED");
  visitor = await ctx.db.get(pass.visitorId);
  if (!visitor || !visitor.isVisitor || visitor.projectId !== device.projectId) return deny("NOT_ALLOWED");
  if (pass.status === "revoked") return deny("REVOKED");
  if (!visitor.isActive) return deny("NOT_ACTIVE");
  const start = visitorTime(visitor.accessStartsAt);
  const end = visitorTime(visitor.accessExpiresAt);
  if (!Number.isFinite(end) || now >= end) return deny("EXPIRED");
  if (!Number.isFinite(start) || now < start) return deny("NOT_STARTED");
  let doorId = device.virtualReaderDoorId ?? null;
  const boundDoor = doorId ? await ctx.db.get(doorId) : null;
  if (doorId && !boundDoor) {
    await ctx.db.patch(device._id, { virtualReaderDoorId: undefined });
    doorId = null;
  }
  if (doorId) {
    const door = boundDoor;
    const rule = visitor.accessRuleId ? await ctx.db.get(visitor.accessRuleId) : null;
    const physicalDevice = door?.deviceId ? await ctx.db.get(door.deviceId) : null;
    if (!door || door.projectId !== projectId || door.status === "inactive" || !physicalDevice || physicalDevice.projectId !== projectId || isVirtualReader(physicalDevice) || !rule || rule.projectId !== projectId || rule.isActive === false) return deny("NOT_ALLOWED");
    const memberships = await ctx.db.query("groupMembers").withIndex("by_project_employee", q => q.eq("projectId", projectId).eq("employeeId", pass.visitorId)).take(201);
    if (memberships.length > 200 || !memberships.some(link => link.groupId === rule._id)) return deny("NOT_ALLOWED");
    const links = await ctx.db.query("groupDoors").withIndex("by_group", q => q.eq("groupId", rule._id)).take(201);
    if (links.length > 200 || !links.some(link => link.doorId === doorId)) return deny("NOT_ALLOWED");
  }
  const direction = await resolveDirection(ctx, { device, employeeId: visitor._id, nowISO: accessTime });
  if (direction === "entry" && (pass.status === "exhausted" || (pass.maxUses !== undefined && pass.usedCount >= pass.maxUses))) return deny("EXHAUSTED");
  const usedCount = pass.usedCount + (direction === "entry" ? 1 : 0);
  const exhausted = pass.status === "exhausted" || (pass.maxUses !== undefined && usedCount >= pass.maxUses);
  await ctx.db.patch(pass._id, { usedCount, status: exhausted ? "exhausted" : "active", lastUsedAt: accessTime, updatedAt: accessTime });
  if (exhausted && pass.status !== "exhausted") await scheduleVisitorCardRemoval(ctx, visitor);
  const employeeName = `${visitor.firstName} ${visitor.lastName}`;
  await ctx.db.insert("cardReadings", {
    projectId: device.projectId, deviceId: device._id, employeeId: visitor._id, cardNo: "",
    employeeName, accessTime, accessStatus: "izin_verildi", direction,
    rawData: JSON.stringify({ source: input.source, protocol: "visitor_pass", passId: pass._id }),
    createdAt: accessTime, updatedAt: accessTime,
  });
  await ctx.db.patch(device._id, { lastSeen: accessTime });
  return { status: "granted", employeeName, direction, accessTime, visitorPassId: pass._id, visitorId: visitor._id, projectId: device.projectId, doorId };
}
