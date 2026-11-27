import { customCtx, customMutation } from "convex-helpers/server/customFunctions";
import { mutation as baseMutation, internalMutation as baseInternalMutation } from "../_generated/server";
import { withDashboardSummary } from "./dashboardSummary";

// Shared registration hook: summaries commit/roll back with the original write.
export const mutation = customMutation(baseMutation, customCtx(withDashboardSummary));
export const internalMutation = customMutation(baseInternalMutation, customCtx(withDashboardSummary));
