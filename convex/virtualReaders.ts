import { ConvexError, v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { authedMutation } from "./lib/customFunctions";
import { createCore } from "./lib/deviceProvision";
import { consumeReaderTokenDetailed } from "./lib/processCardReadingCore";
import { isVirtualReader, READER_TOKEN_PATTERN, VIRTUAL_READER_TYPE } from "./lib/virtualReader";

const LAST_SEEN_THROTTLE_MS = 60_000;

/**
 * Cihazlar → Cihaz ekle → Sanal okuyucu. Okuyucu ekranı bağlantısı için token döner.
 * Yön cihazda seçilmez: PDKS ayarlarındaki nokta tipi belirler, yoksa giriş/çıkış sırayla.
 */
export const create = authedMutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({ deviceId: v.id("devices"), readerToken: v.string() }),
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Okuyucu adı zorunlu");
    const deviceId = await createCore(ctx, {
      ...args, name, description: args.description?.trim() || undefined,
      brand: "other", deviceType: VIRTUAL_READER_TYPE, status: "active",
    });
    const readerToken = crypto.randomUUID();
    const now = new Date().toISOString();
    await ctx.db.patch(deviceId, { apiToken: readerToken, apiTokenCreatedAt: now, updatedAt: now });
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
    if (device.isActive === false) return { status: "denied" as const, reason: "READER_INACTIVE" as const };
    const value = code.trim();
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
