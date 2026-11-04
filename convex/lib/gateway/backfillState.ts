import { v, type Infer } from "convex/values";

// Shared by the durable device checkpoint and the scheduled continuation.
export const hikBackfillContinuationFields = {
  devIndex: v.string(),
  searchID: v.string(),
  position: v.number(),
  startedAt: v.number(),
  lastProgressAt: v.optional(v.number()),
  failCount: v.optional(v.number()),
  maxPages: v.number(),
  startTime: v.optional(v.string()),
  lastEventAt: v.optional(v.number()),
  maxSerialNo: v.optional(v.number()),
  lastPageKey: v.optional(v.string()),
};
export const hikBackfillPendingValidator = v.object(hikBackfillContinuationFields);
export type HikBackfillPending = Infer<typeof hikBackfillPendingValidator>;
