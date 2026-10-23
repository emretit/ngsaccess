import { v } from "convex/values";

export const SHIFT_COLOR_KEYS = ["slate", "blue", "teal", "green", "amber", "orange", "rose", "violet"] as const;
export type ShiftColor = typeof SHIFT_COLOR_KEYS[number];

export const shiftColorValidator = v.union(
  v.literal("slate"), v.literal("blue"), v.literal("teal"), v.literal("green"),
  v.literal("amber"), v.literal("orange"), v.literal("rose"), v.literal("violet"),
);
