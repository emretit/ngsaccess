import { v } from "convex/values";
import { query } from "./_generated/server";
import { adminMutation, authedQuery } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";
import { getProjectIdsForUser } from "./lib/auth";
import { getTurkishHolidaysForYear, hasReligiousData } from "./lib/turkishHolidays";

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

export const listForRange = authedQuery({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const allowedProjectIds = await getProjectIdsForUser(ctx);
    let rows;
    if (ctx.user.role === "super_admin") {
      rows = await ctx.db.query("holidays").collect();
    } else if (allowedProjectIds.length > 0) {
      const [projectRows, globalRows] = await Promise.all([
        Promise.all(
          allowedProjectIds.map((pid) =>
            ctx.db
              .query("holidays")
              .withIndex("by_project", (q) => q.eq("projectId", pid))
              .collect(),
          ),
        ),
        ctx.db
          .query("holidays")
          .withIndex("by_project", (q) => q.eq("projectId", undefined))
          .collect(),
      ]);
      rows = [...projectRows.flat(), ...globalRows];
    } else {
      return [];
    }
    return rows.filter((r) => r.date >= args.startDate && r.date <= args.endDate);
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

export const seedTurkishHolidays = adminMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    years: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let skipped = 0;
    const missingYears: number[] = [];

    for (const year of args.years) {
      if (!hasReligiousData(year)) missingYears.push(year);
      const list = getTurkishHolidaysForYear(year);
      for (const h of list) {
        const existing = await ctx.db
          .query("holidays")
          .withIndex("by_project_date", (q) =>
            q.eq("projectId", args.projectId).eq("date", h.date)
          )
          .first();
        if (existing) {
          skipped += 1;
          continue;
        }
        await ctx.db.insert("holidays", {
          projectId: args.projectId,
          date: h.date,
          name: h.name,
          isHalfDay: h.isHalfDay ?? false,
          type: h.type,
          createdAt: new Date().toISOString(),
        });
        inserted += 1;
      }
    }

    await writeAudit(ctx, {
      user: ctx.user,
      projectId: args.projectId ?? null,
      action: "create",
      targetTable: "holidays",
      targetId: "bulk-seed",
      newValue: { years: args.years, insertedCount: inserted },
      note: `TR resmi tatil seed: ${inserted} eklendi, ${skipped} mevcut`,
    });

    return { inserted, skipped, missingReligiousYears: missingYears };
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
