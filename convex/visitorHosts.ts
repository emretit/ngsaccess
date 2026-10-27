import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { resolveProjectScope } from "./lib/projectScope";
import { requirePermission } from "./lib/permissions";

export type VisitorHostOption = Pick<Doc<"employees">, "_id" | "firstName" | "lastName"> & { isActive: boolean };

/** Only names needed by the visitor form; every index read is bounded. */
export const search = authedQuery({
  args: { projectId: v.id("projects"), search: v.string() },
  returns: v.array(v.object({ _id: v.id("employees"), firstName: v.string(), lastName: v.string(), isActive: v.boolean() })),
  handler: async (ctx, args) => {
    await resolveProjectScope(ctx, args.projectId);
    await requirePermission(ctx, ctx.user, args.projectId, "visitors.manage");
    const term = args.search.trim().slice(0, 100);
    const terms = term.split(/\s+/);
    const firstTerm = terms[0] ?? "";
    const lastTerm = terms[terms.length - 1] ?? "";
    const rows = term
      ? (await Promise.all([
        ctx.db.query("employees").withSearchIndex("search_first_name", q => q.search("firstName", firstTerm).eq("projectId", args.projectId)).take(50),
        ctx.db.query("employees").withSearchIndex("search_last_name", q => q.search("lastName", lastTerm).eq("projectId", args.projectId)).take(50),
      ])).flat()
      : (await Promise.all([
        ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", args.projectId).eq("isVisitor", false)).take(50),
        ctx.db.query("employees").withIndex("by_project_visitor", q => q.eq("projectId", args.projectId).eq("isVisitor", undefined)).take(50),
      ])).flat();
    return [...new Map(rows.filter(row => {
      if (row.isVisitor === true) return false;
      if (terms.length < 2) return true;
      const words = `${row.firstName} ${row.lastName}`.toLocaleLowerCase("tr").split(/\s+/);
      return terms.every(part => words.some(word => word.startsWith(part.toLocaleLowerCase("tr"))));
    }).map(row => [row._id, row])).values()]
      .slice(0, 50)
      .map(({ _id, firstName, lastName, isActive }) => ({ _id, firstName, lastName, isActive: isActive === true }));
  },
});
