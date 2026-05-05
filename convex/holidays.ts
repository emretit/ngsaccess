import { v } from "convex/values";
import { query } from "./_generated/server";
import { adminMutation, authedQuery } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = args.projectId
      ? await ctx.db
          .query("holidays")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect()
      : await ctx.db.query("holidays").collect();

    if (args.year === undefined) return rows;
    const prefix = `${args.year}-`;
    return rows.filter((r) => r.date.startsWith(prefix));
  },
});

export const create = adminMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    date: v.string(),
    name: v.string(),
    isHalfDay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("holidays")
      .withIndex("by_project_date", (q) =>
        q.eq("projectId", args.projectId).eq("date", args.date)
      )
      .first();
    if (existing) {
      throw new Error("Bu tarihte zaten bir tatil kaydı var");
    }
    const id = await ctx.db.insert("holidays", {
      projectId: args.projectId,
      date: args.date,
      name: args.name,
      isHalfDay: args.isHalfDay ?? false,
      createdAt: new Date().toISOString(),
    });
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: args.projectId ?? null,
      action: "create",
      targetTable: "holidays",
      targetId: id,
      newValue: { date: args.date, name: args.name, isHalfDay: args.isHalfDay },
    });
    return id;
  },
});

export const remove = adminMutation({
  args: { id: v.id("holidays") },
  handler: async (ctx, args) => {
    const old = await ctx.db.get(args.id);
    if (!old) return;
    await ctx.db.delete(args.id);
    await writeAudit(ctx, {
      user: ctx.user,
      projectId: old.projectId ?? null,
      action: "delete",
      targetTable: "holidays",
      targetId: args.id,
      oldValue: { date: old.date, name: old.name, isHalfDay: old.isHalfDay },
    });
  },
});

interface SeedHoliday {
  date: string;
  name: string;
  isHalfDay?: boolean;
}

const TR_HOLIDAYS_BY_YEAR: Record<number, SeedHoliday[]> = {
  2026: [
    { date: "2026-01-01", name: "Yılbaşı" },
    { date: "2026-03-19", name: "Ramazan Bayramı Arefesi", isHalfDay: true },
    { date: "2026-03-20", name: "Ramazan Bayramı 1. Gün" },
    { date: "2026-03-21", name: "Ramazan Bayramı 2. Gün" },
    { date: "2026-03-22", name: "Ramazan Bayramı 3. Gün" },
    { date: "2026-04-23", name: "Ulusal Egemenlik ve Çocuk Bayramı" },
    { date: "2026-05-01", name: "Emek ve Dayanışma Günü" },
    { date: "2026-05-19", name: "Atatürk'ü Anma, Gençlik ve Spor Bayramı" },
    { date: "2026-05-26", name: "Kurban Bayramı Arefesi", isHalfDay: true },
    { date: "2026-05-27", name: "Kurban Bayramı 1. Gün" },
    { date: "2026-05-28", name: "Kurban Bayramı 2. Gün" },
    { date: "2026-05-29", name: "Kurban Bayramı 3. Gün" },
    { date: "2026-05-30", name: "Kurban Bayramı 4. Gün" },
    { date: "2026-07-15", name: "Demokrasi ve Milli Birlik Günü" },
    { date: "2026-08-30", name: "Zafer Bayramı" },
    { date: "2026-10-28", name: "Cumhuriyet Bayramı Arefesi", isHalfDay: true },
    { date: "2026-10-29", name: "Cumhuriyet Bayramı" },
  ],
  2027: [
    { date: "2027-01-01", name: "Yılbaşı" },
    { date: "2027-03-08", name: "Ramazan Bayramı Arefesi", isHalfDay: true },
    { date: "2027-03-09", name: "Ramazan Bayramı 1. Gün" },
    { date: "2027-03-10", name: "Ramazan Bayramı 2. Gün" },
    { date: "2027-03-11", name: "Ramazan Bayramı 3. Gün" },
    { date: "2027-04-23", name: "Ulusal Egemenlik ve Çocuk Bayramı" },
    { date: "2027-05-01", name: "Emek ve Dayanışma Günü" },
    { date: "2027-05-16", name: "Kurban Bayramı Arefesi", isHalfDay: true },
    { date: "2027-05-17", name: "Kurban Bayramı 1. Gün" },
    { date: "2027-05-18", name: "Kurban Bayramı 2. Gün" },
    { date: "2027-05-19", name: "Atatürk'ü Anma + Kurban Bayramı 3. Gün" },
    { date: "2027-05-20", name: "Kurban Bayramı 4. Gün" },
    { date: "2027-07-15", name: "Demokrasi ve Milli Birlik Günü" },
    { date: "2027-08-30", name: "Zafer Bayramı" },
    { date: "2027-10-28", name: "Cumhuriyet Bayramı Arefesi", isHalfDay: true },
    { date: "2027-10-29", name: "Cumhuriyet Bayramı" },
  ],
};

export const seedTurkishHolidays = adminMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    years: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const inserted: string[] = [];
    const skipped: string[] = [];

    for (const year of args.years) {
      const list = TR_HOLIDAYS_BY_YEAR[year];
      if (!list) continue;

      for (const h of list) {
        const existing = await ctx.db
          .query("holidays")
          .withIndex("by_project_date", (q) =>
            q.eq("projectId", args.projectId).eq("date", h.date)
          )
          .first();
        if (existing) {
          skipped.push(h.date);
          continue;
        }
        await ctx.db.insert("holidays", {
          projectId: args.projectId,
          date: h.date,
          name: h.name,
          isHalfDay: h.isHalfDay ?? false,
          createdAt: new Date().toISOString(),
        });
        inserted.push(h.date);
      }
    }

    await writeAudit(ctx, {
      user: ctx.user,
      projectId: args.projectId ?? null,
      action: "create",
      targetTable: "holidays",
      targetId: "bulk-seed",
      newValue: { years: args.years, insertedCount: inserted.length },
      note: `TR resmi tatil seed: ${inserted.length} eklendi, ${skipped.length} mevcut`,
    });

    return { inserted: inserted.length, skipped: skipped.length };
  },
});

export const getOvertimeRates = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const rates = await ctx.db
      .query("overtimeRates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();
    return (
      rates ?? {
        projectId: args.projectId,
        weekdayMultiplier: 1.5,
        weekendMultiplier: 2.0,
        holidayMultiplier: 2.0,
        nightShiftMultiplier: 1.5,
        nightShiftStart: "22:00",
        nightShiftEnd: "06:00",
      }
    );
  },
});

export const upsertOvertimeRates = adminMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    weekdayMultiplier: v.number(),
    weekendMultiplier: v.number(),
    holidayMultiplier: v.number(),
    nightShiftMultiplier: v.number(),
    nightShiftStart: v.string(),
    nightShiftEnd: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("overtimeRates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    const payload = {
      projectId: args.projectId,
      weekdayMultiplier: args.weekdayMultiplier,
      weekendMultiplier: args.weekendMultiplier,
      holidayMultiplier: args.holidayMultiplier,
      nightShiftMultiplier: args.nightShiftMultiplier,
      nightShiftStart: args.nightShiftStart,
      nightShiftEnd: args.nightShiftEnd,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      await writeAudit(ctx, {
        user: ctx.user,
        projectId: args.projectId ?? null,
        action: "update",
        targetTable: "overtimeRates",
        targetId: existing._id,
        oldValue: existing,
        newValue: payload,
      });
      return existing._id;
    } else {
      const id = await ctx.db.insert("overtimeRates", payload);
      await writeAudit(ctx, {
        user: ctx.user,
        projectId: args.projectId ?? null,
        action: "create",
        targetTable: "overtimeRates",
        targetId: id,
        newValue: payload,
      });
      return id;
    }
  },
});
