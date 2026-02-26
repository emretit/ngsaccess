import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

const messageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  data: v.optional(v.any()),
});

export const save = authedMutation({
  args: {
    projectId: v.optional(v.id("projects")),
    title: v.optional(v.string()),
    messages: v.array(messageValidator),
  },
  returns: v.id("chatConversations"),
  handler: async (ctx, args) => {
    if (args.projectId) {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (!allowedProjectIds.some((id) => id === args.projectId)) {
        throw new Error("Bu projeye erişim yetkiniz yok");
      }
    }
    const now = new Date().toISOString();
    return await ctx.db.insert("chatConversations", {
      projectId: args.projectId,
      title: args.title ?? "Sohbet",
      messages: args.messages,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = authedQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const allowedProjectIds = await getProjectIdsForUser(ctx);

    if (args.projectId) {
      if (!allowedProjectIds.some((id) => id === args.projectId)) {
        return [];
      }
      return await ctx.db
        .query("chatConversations")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .take(limit);
    }

    const results: Doc<"chatConversations">[] = [];
    for (const pid of allowedProjectIds) {
      const convos = await ctx.db
        .query("chatConversations")
        .withIndex("by_project", (q) => q.eq("projectId", pid))
        .order("desc")
        .take(limit);
      results.push(...convos);
    }
    results.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
    return results.slice(0, limit);
  },
});
