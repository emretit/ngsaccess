import { requirePermission } from "./lib/permissions";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { writeAudit } from "./lib/audit";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { getTurkishHolidaysForYear, hasReligiousData } from "./lib/turkishHolidays";

type HolidayCtx = (QueryCtx | MutationCtx) & { user: Doc<"users"> };

async function requireHolidayScope(ctx: HolidayCtx, projectId: Id<"projects"> | undefined, write = false) {
  if (write) await requirePermission(ctx, ctx.user, projectId, "schedule.manage");
  if (ctx.user.role === "super_admin") return;
  if (!projectId) {
    if (write) throw new Error("Global tatilleri yalnız süper admin değiştirebilir");
    return;
  }
  if (!isProjectAllowed(await getProjectIdsForUser(ctx), projectId)) {
    throw new Error("Bu projeye erişim yetkiniz yok");
  }
}

async function visibleHolidays(ctx: HolidayCtx) {
  if (ctx.user.role === "super_admin") return await ctx.db.query("holidays").collect();
  const projectIds = await getProjectIdsForUser(ctx);
  return (await Promise.all([undefined, ...projectIds].map(projectId => ctx.db
    .query("holidays").withIndex("by_project", q => q.eq("projectId", projectId)).collect()))).flat();
}

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireHolidayScope(ctx, args.projectId);
    const rows = args.projectId
      ? await ctx.db
          .query("holidays")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect()
      : await visibleHolidays(ctx);

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
    const rows = await visibleHolidays(ctx);
    return rows.filter((r) => r.date >= args.startDate && r.date <= args.endDate);
  },
});

export const create = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    date: v.string(),
    name: v.string(),
    isHalfDay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireHolidayScope(ctx, args.projectId, true);
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

export const remove = authedMutation({
  args: { id: v.id("holidays") },
  handler: async (ctx, args) => {
    const old = await ctx.db.get(args.id);
    if (!old) return;
    await requireHolidayScope(ctx, old.projectId, true);
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

export const seedTurkishHolidays = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    years: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    await requireHolidayScope(ctx, args.projectId, true);
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

export const getOvertimeRates = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    await requireHolidayScope(ctx, args.projectId);
    const rates = await ctx.db
      .query("overtimeRates")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();
    return (
      rates ?? {
        projectId: args.projectId,
        overtimeBasis: "weekly45" as const,
        nightShiftDayMode: "shiftStart" as const,
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

