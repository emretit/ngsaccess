import { checkInTokenState, CHECK_IN_TOKEN_TTL_MS } from "./lib/checkInUx";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { employeeAuthedMutation } from "./lib/customFunctions";

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
    const expiresAt = new Date(now.getTime() + CHECK_IN_TOKEN_TTL_MS).toISOString();
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

    const state = checkInTokenState(record, Date.now());
    if (!record || state === "invalid") {
      return { success: false, code: "invalid_token", error: "Geçersiz veya süresi dolmuş kod" };
    }
    if (state === "expired") {
      return { success: false, code: "expired_token", error: "Kodun süresi doldu" };
    }

    if (state === "completed") {
      return {
        success: true,
        employeeName: record.employeeName,
        accessTime: record.usedAt,
        locationRecorded: record.locationRecorded,
      };
    }

    const employee = await ctx.db.get(record.employeeId);
    if (!employee) {
      return { success: false, code: "employee_not_found", error: "Çalışan bulunamadı" };
    }

    const now = new Date().toISOString();
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    const locationRecorded = args.latitude != null && args.longitude != null;
    await ctx.db.patch(record._id, { usedAt: now, employeeName, locationRecorded });

    await ctx.db.insert("cardReadings", {
      projectId: employee.projectId,
      employeeId: record.employeeId,
      cardNo: employee.cardNumber,
      employeeName,
      accessTime: now,
      accessStatus: "izin_verildi",
      rawData: args.latitude != null ? `qr_checkin:lat=${args.latitude},lng=${args.longitude}` : "qr_checkin",
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      employeeName,
      accessTime: now,
      locationRecorded,
    };
  },
});
