import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { authedMutation } from "./lib/customFunctions";
import { createCore } from "./lib/deviceProvision";
import { consumeReaderTokenDetailed } from "./lib/processCardReadingCore";
import { isVirtualReader, READER_TOKEN_PATTERN, VIRTUAL_READER_TYPE } from "./lib/virtualReader";
import { consumeVisitorPass } from "./lib/visitorPass";
import { openVisitorDoor } from "./lib/doorOpenDispatch";
import { requirePermission } from "./lib/permissions";
import { resolveProjectScope } from "./lib/projectScope";
import type { Id } from "./_generated/dataModel";

const visitorGranted = v.object({
  status: v.literal("granted"), employeeName: v.string(), direction: v.union(v.literal("entry"), v.literal("exit")), accessTime: v.string(),
  visitorPassId: v.id("visitorPasses"), visitorId: v.id("employees"), projectId: v.id("projects"), doorId: v.union(v.id("doors"), v.null()),
  doorOpen: v.optional(v.union(v.literal("pending"), v.literal("confirmed"), v.literal("failed"))),
  doorOpenOperationId: v.optional(v.id("mobileAccessOperations")), doorOpenMessage: v.optional(v.string()),
});
const visitorDenied = v.object({ status: v.literal("denied"), reason: v.union(
  v.literal("TOKEN_INVALID"), v.literal("READER_INACTIVE"), v.literal("PIN_LOCKED"), v.literal("NOT_ALLOWED"),
  v.literal("NOT_ACTIVE"), v.literal("NOT_STARTED"), v.literal("EXPIRED"), v.literal("REVOKED"), v.literal("EXHAUSTED"),
) });

const LAST_SEEN_THROTTLE_MS = 60_000;

async function validateReaderDoor(ctx: MutationCtx, projectId: Id<"projects"> | undefined, doorId: Id<"doors">) {
  const door = await ctx.db.get(doorId);
  const physicalDevice = door?.deviceId ? await ctx.db.get(door.deviceId) : null;
  if (!door || door.projectId !== projectId || !physicalDevice || physicalDevice.projectId !== projectId || isVirtualReader(physicalDevice)) {
    throw new ConvexError("Kapı bu projede fiziksel bir cihaza bağlı olmalıdır");
  }
}

export const setDoor = authedMutation({
  args: { deviceId: v.id("devices"), doorId: v.union(v.id("doors"), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || !isVirtualReader(device)) throw new ConvexError("Sanal okuyucu bulunamadı");
    await requirePermission(ctx, ctx.user, device.projectId, "devices.manage");
    await resolveProjectScope(ctx, device.projectId);
    if (args.doorId) await validateReaderDoor(ctx, device.projectId, args.doorId);
    await ctx.db.patch(device._id, { virtualReaderDoorId: args.doorId ?? undefined, updatedAt: new Date().toISOString() });
    return null;
  },
});

/**
 * Cihazlar → Cihaz ekle → Sanal okuyucu. Okuyucu ekranı bağlantısı için token döner.
 * Yön cihazda seçilmez: PDKS ayarlarındaki nokta tipi belirler, yoksa giriş/çıkış sırayla.
 */
export const create = authedMutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    doorId: v.optional(v.id("doors")),
  },
  returns: v.object({ deviceId: v.id("devices"), readerToken: v.string() }),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Okuyucu adı zorunlu");
    if (args.doorId) await validateReaderDoor(ctx, args.projectId, args.doorId);
    const deviceId = await createCore(ctx, {
      projectId: args.projectId, name, description: args.description?.trim() || undefined,
      brand: "other", deviceType: VIRTUAL_READER_TYPE, status: "active",
    });
    const readerToken = crypto.randomUUID();
    const now = new Date().toISOString();
    await ctx.db.patch(deviceId, { apiToken: readerToken, apiTokenCreatedAt: now, updatedAt: now, virtualReaderDoorId: args.doorId });
    return { deviceId, readerToken };
  },
});

async function readerByToken(ctx: MutationCtx, readerToken: string) {
  if (!READER_TOKEN_PATTERN.test(readerToken)) return null;
  const device = await ctx.db.query("devices")
    .withIndex("by_api_token", q => q.eq("apiToken", readerToken)).first();
  return device && isVirtualReader(device) ? device : null;
}

/** Okuyucu ekranı açılınca ve periyodik olarak çağrılır; cihazı çevrimiçi gösterir. */
export const connect = mutation({
  args: { readerToken: v.string() },
  returns: v.union(v.null(), v.object({
    name: v.string(),
    isActive: v.boolean(),
    projectName: v.union(v.string(), v.null()),
  })),
  handler: async (ctx, { readerToken }) => {
    const device = await readerByToken(ctx, readerToken);
    if (!device) return null;
    const now = Date.now();
    const lastSeen = device.lastSeen ? Date.parse(device.lastSeen) : NaN;
    if (!Number.isFinite(lastSeen) || now - lastSeen >= LAST_SEEN_THROTTLE_MS) {
      await ctx.db.patch(device._id, { lastSeen: new Date(now).toISOString() });
    }
    const project = device.projectId ? await ctx.db.get(device.projectId) : null;
    return {
      name: device.name,
      isActive: device.isActive !== false,
      projectName: project?.name ?? null,
    };
  },
});

/** Çalışanın mobil uygulamadaki tek kullanımlık QR'ını okuyucu adına tüketir. */
export const scan = mutation({
  args: { readerToken: v.string(), code: v.string() },
  returns: v.union(
    visitorGranted,
    visitorDenied,
    v.object({
      status: v.literal("granted"),
      employeeName: v.string(),
      direction: v.union(v.literal("entry"), v.literal("exit")),
      accessTime: v.string(),
    }),
    v.object({
      status: v.literal("denied"),
      reason: v.union(
        v.literal("TOKEN_INVALID"), v.literal("TOKEN_USED"), v.literal("TOKEN_EXPIRED"),
        v.literal("SESSION_INVALID"), v.literal("NOT_ALLOWED"), v.literal("READER_INACTIVE"),
      ),
    }),
    v.object({ status: v.literal("reader_invalid") }),
  ),
  handler: async (ctx, { readerToken, code }) => {
    const device = await readerByToken(ctx, readerToken);
    if (!device) return { status: "reader_invalid" as const };
    const value = code.trim();
    if (value.startsWith("NGSV1.")) return openVisitorDoor(ctx, device, await consumeVisitorPass(ctx, device, { source: "qr", code: value }));
    if (device.isActive === false) return { status: "denied" as const, reason: "READER_INACTIVE" as const };
    if (!READER_TOKEN_PATTERN.test(value)) return { status: "denied" as const, reason: "TOKEN_INVALID" as const };
    const outcome = await consumeReaderTokenDetailed(ctx, value, device);
    if (!outcome.granted) return { status: "denied" as const, reason: outcome.reason };
    await ctx.db.patch(device._id, { lastSeen: outcome.accessTime });
    return {
      status: "granted" as const,
      employeeName: outcome.employeeName,
      direction: outcome.direction,
      accessTime: outcome.accessTime,
    };
  },
});

export const scanPin = mutation({
  args: { readerToken: v.string(), pin: v.string() },
  returns: v.union(visitorGranted, visitorDenied, v.object({ status: v.literal("reader_invalid") })),
  handler: async (ctx, { readerToken, pin }) => {
    const device = await readerByToken(ctx, readerToken);
    if (!device) return { status: "reader_invalid" as const };
    return openVisitorDoor(ctx, device, await consumeVisitorPass(ctx, device, { source: "pin", code: pin.trim() }));
  },
});
