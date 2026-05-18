import { v } from "convex/values";
import { authedQuery, authedMutation } from "./lib/customFunctions";

export const get = authedQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", ctx.user._id).eq("key", args.key),
      )
      .first();
    return row?.value ?? null;
  },
});

export const set = authedMutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", ctx.user._id).eq("key", args.key),
      )
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("userPreferences", {
      userId: ctx.user._id,
      key: args.key,
      value: args.value,
      updatedAt: now,
    });
  },
});

export const remove = authedMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", ctx.user._id).eq("key", args.key),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
