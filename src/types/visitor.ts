import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

export type VisitorPage = FunctionReturnType<typeof api.visitors.listPage>;
export type Visitor = VisitorPage["page"][number];
export type VisitorDetail = NonNullable<FunctionReturnType<typeof api.visitors.getDetail>>;
export type VisitorSummary = FunctionReturnType<typeof api.visitors.summary>;
export type VisitorPresetRule = FunctionReturnType<typeof api.visitors.presetRules>[number];
