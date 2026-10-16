import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { resolveProjectScope, selectProjectScope } from "./projectScope";
import { isManager } from "./auth";

export function reportPeriod(year: number, month?: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100 ||
      (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12))) {
    throw new Error("Geçerli bir yıl ve ay seçin");
  }
  return {
    startDate: `${year}-${String(month ?? 1).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month ?? 12).padStart(2, "0")}-${new Date(Date.UTC(year, month ?? 12, 0)).getUTCDate()}`,
  };
}

export async function reportScopeLabel(ctx: QueryCtx, projectIds: Id<"projects">[], all: boolean) {
  const projects = (await Promise.all(projectIds.map((id) => ctx.db.get(id))))
    .filter((p): p is NonNullable<typeof p> => p !== null);
  return `${all ? "Tüm erişilebilir projeler: " : ""}${projects.map((p) => p.name).join(", ") || "Erişilebilir proje yok"}`;
}

export async function resolveReportScope(ctx: QueryCtx, projectId?: Id<"projects">) {
  const projectIds = await resolveProjectScope(ctx, projectId);
  return { projectIds, scopeLabel: await reportScopeLabel(ctx, projectIds, projectId === undefined) };
}

export async function readReportReadings(ctx: QueryCtx, projectIds: Id<"projects">[], startISO: string, endISO: string) {
  return (await Promise.all(projectIds.map((projectId) => ctx.db.query("cardReadings")
    .withIndex("by_project_access_time", (q) => q.eq("projectId", projectId).gte("accessTime", startISO).lte("accessTime", endISO))
    .collect()))).flat();
}

export function selectScheduleProjectIds(user: Doc<"users"> | null, allowed: Id<"projects">[], projectId?: Id<"projects">) {
  if (!user || user.verified === false || !isManager(user)) return null;
  if (projectId && !allowed.includes(projectId)) return null;
  const projectIds = selectProjectScope(allowed, projectId);
  return projectIds.length ? projectIds : null;
}

/** Cron'da oturum yoktur: kayıt sahibinin güncel rolü ve üyelikleri DB'den doğrulanır. */
export async function resolveScheduleScope(ctx: QueryCtx, schedule: Doc<"reportScheduleSettings">) {
  const user = await ctx.db.get(schedule.userId);
  if (!user || user.verified === false || !isManager(user)) return null;
  const allowed = user.role === "super_admin"
    ? (await ctx.db.query("projects").collect()).map((p) => p._id)
    : (await ctx.db.query("userProjects").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()).map((p) => p.projectId);
  const projectIds = selectScheduleProjectIds(user, allowed, schedule.projectId);
  if (!projectIds) return null;
  return { projectIds, scopeLabel: await reportScopeLabel(ctx, projectIds, schedule.projectId === undefined) };
}
