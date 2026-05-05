import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { employeeAuthedMutation } from "./lib/customFunctions";

/**
 * Çalışan için QR check-in token oluşturur (5 dakika geçerli).
 * Web admin/portal tarafı kullanıyor — `employeeId` parametresiyle.
 */
export const createCheckInToken = mutation({
  args: {
    employeeId: v.id("employees"),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Çalışan bulunamadı");

    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    const createdAt = now.toISOString();

    await ctx.db.insert("checkInTokens", {
      employeeId: args.employeeId,
      token,
      expiresAt,
      createdAt,
    });

    return { token, expiresAt };
  },
});

/**
 * Mobil çalışan oturumu için: kendi adına QR check-in token üretir.
 * `ctx.employee` `employeeAuthedMutation` tarafından enjekte edilir.
 */
export const createMyCheckInToken = employeeAuthedMutation({
  args: {},
  handler: async (ctx) => {
    const employee = ctx.employee;

    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 1000).toISOString();
    const createdAt = now.toISOString();

    await ctx.db.insert("checkInTokens", {
      employeeId: employee._id,
      token,
      expiresAt,
      createdAt,
    });

    return { token, expiresAt };
  },
});

/**
 * QR kod ile check-in kaydı oluşturur (HTTP veya client'tan çağrılır)
 */
export const checkInWithToken = mutation({
  args: {
    token: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("checkInTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!record) {
      return { success: false, error: "Geçersiz veya süresi dolmuş kod" };
    }
    if (record.usedAt) {
      return { success: false, error: "Bu kod zaten kullanıldı" };
    }
    if (new Date() > new Date(record.expiresAt)) {
      return { success: false, error: "Kodun süresi doldu" };
    }

    const employee = await ctx.db.get(record.employeeId);
    if (!employee) {
      return { success: false, error: "Çalışan bulunamadı" };
    }

    const now = new Date().toISOString();
    await ctx.db.patch(record._id, { usedAt: now });

    await ctx.db.insert("cardReadings", {
      projectId: employee.projectId,
      employeeId: record.employeeId,
      cardNo: employee.cardNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime: now,
      accessStatus: "izin_verildi",
      rawData: args.latitude != null ? `qr_checkin:lat=${args.latitude},lng=${args.longitude}` : "qr_checkin",
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      accessTime: now,
    };
  },
});
