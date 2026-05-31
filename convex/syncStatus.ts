import { v } from "convex/values";
import { authedQuery } from "./lib/customFunctions";
import { getProjectIdsForUser, isProjectAllowed } from "./lib/auth";
import { isBenignSyncError } from "./lib/syncErrors";
import type { Id } from "./_generated/dataModel";

/**
 * Reaktif cihaz-sync durumu (IDE Smart + Hikvision birlikte). UI'da kalıcı "Cihaz güncel" /
 * "senkronize ediliyor" şeridini besler; useQuery ile canlı güncellenir.
 *
 * Verimlilik: terminal-success satırları (acked/done — çok olabilir) ASLA taranmaz.
 * Yalnız uçuştaki (pending/sent/processing) + failed durumlar status-önekli index'lerle
 * okunur ve savunma amaçlı .take(SCAN_CAP) ile sınırlanır. Proje RBAC bellek içinde uygulanır
 * (mevcut listSyncIssues deseniyle aynı; [projectId,status] compound index yok).
 */

const SCAN_CAP = 200;

interface BrandBreakdown {
  inFlight: number;
  failed: number;
}

export const deviceSyncStatus = authedQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    inFlight: number;
    failed: number;
    upToDate: boolean;
    ide: BrandBreakdown;
    hik: BrandBreakdown;
  }> => {
    const allowed = await getProjectIdsForUser(ctx);
    const visible = (projectId: Id<"projects"> | undefined): boolean =>
      isProjectAllowed(allowed, projectId) &&
      (args.projectId === undefined || projectId === args.projectId);

    const [idePending, ideSent, ideFailed, hikPending, hikProcessing, hikFailed] =
      await Promise.all([
        ctx.db
          .query("idePendingOperations")
          .withIndex("by_status_nextRetry", (q) => q.eq("status", "pending"))
          .take(SCAN_CAP),
        ctx.db
          .query("idePendingOperations")
          .withIndex("by_status_nextRetry", (q) => q.eq("status", "sent"))
          .take(SCAN_CAP),
        ctx.db
          .query("idePendingOperations")
          .withIndex("by_status_nextRetry", (q) => q.eq("status", "failed"))
          .take(SCAN_CAP),
        ctx.db
          .query("hikPendingOperations")
          .withIndex("by_status_created", (q) => q.eq("status", "pending"))
          .take(SCAN_CAP),
        ctx.db
          .query("hikPendingOperations")
          .withIndex("by_status_created", (q) => q.eq("status", "processing"))
          .take(SCAN_CAP),
        ctx.db
          .query("hikPendingOperations")
          .withIndex("by_status_created", (q) => q.eq("status", "failed"))
          .take(SCAN_CAP),
      ]);

    const countVisible = (
      rows: ReadonlyArray<{ projectId?: Id<"projects"> }>,
    ): number => rows.filter((r) => visible(r.projectId)).length;

    // failed: benign ("already exists" = cihaz güncel) hariç — kırmızı banner'la aynı filtre.
    const countRealFailed = (
      rows: ReadonlyArray<{ projectId?: Id<"projects">; lastError?: string }>,
    ): number =>
      rows.filter((r) => visible(r.projectId) && !isBenignSyncError(r.lastError)).length;

    const ide: BrandBreakdown = {
      inFlight: countVisible(idePending) + countVisible(ideSent),
      failed: countRealFailed(ideFailed),
    };
    const hik: BrandBreakdown = {
      inFlight: countVisible(hikPending) + countVisible(hikProcessing),
      failed: countRealFailed(hikFailed),
    };
    const inFlight = ide.inFlight + hik.inFlight;
    const failed = ide.failed + hik.failed;

    return { inFlight, failed, upToDate: inFlight === 0 && failed === 0, ide, hik };
  },
});
