"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { trCalendarDate } from "../lib/trDate";
import { escapeHtml } from "../lib/escapers";
import { renderEmailTemplate } from "../lib/emailTemplate";
import { deliverProjectMail } from "../lib/projectMailer";

async function sendDelivery(ctx: ActionCtx, args: { scheduleId: Id<"reportScheduleSettings">; year: number; month: number }): Promise<void> {
  const delivery = await ctx.runMutation(internal.reports.claimReportDelivery, args);
  if (!delivery) return;
  let outcome: "sent" | "failed" | "skipped" = "failed";
  let error: string | undefined;
  try {
    const summary = await ctx.runQuery(internal.reports.getReportSummaryForEmail, {
      ...args, deliveryId: delivery._id,
    });
    if (!summary) {
      outcome = "skipped";
      error = "schedule_changed_or_inaccessible";
    } else {
      const subject = `${summary.title} — ${args.year}/${args.month}`;
      const html = renderEmailTemplate({
        title: escapeHtml(subject),
        heading: "Aylık rapor özeti",
        body: `<strong>${escapeHtml(summary.title)}</strong><br/>${escapeHtml(summary.summary)}`,
        ctaUrl: `${process.env.SITE_URL ?? "https://ngsplus.app"}/settings?tab=reports`,
        ctaLabel: "Ayarlar → Raporlar",
        footerNote: "Bu e-posta Ayarlar › Raporlar › Kişisel e-posta hatırlatması açık olduğu için gönderildi.",
      });
      const sent = await deliverProjectMail(ctx, delivery.projectId, { to: delivery.email, subject, html });
      outcome = sent.ok ? "sent" : "failed";
      if (!sent.ok) error = sent.error;
    }
  } catch (cause: unknown) {
    error = cause instanceof Error ? cause.message : "Bilinmeyen gönderim hatası";
  }
  // Keep acknowledgement outside the mail try/catch: a lost DB acknowledgement must
  // leave "sending" for outcome_unknown reconciliation, never trigger a blind resend.
  await ctx.runMutation(internal.reports.finishReportDelivery, {
    deliveryId: delivery._id, attempt: delivery.attempts, outcome, ...(error ? { error } : {}),
  });
}

export const sendReportDelivery = internalAction({
  args: { scheduleId: v.id("reportScheduleSettings"), year: v.number(), month: v.number() },
  handler: sendDelivery,
});

export const sendMonthlyReports = internalAction({
  args: {},
  handler: async (ctx) => {
    const prevMonth = trCalendarDate(new Date().toISOString());
    prevMonth.setUTCDate(1);
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    const year = prevMonth.getUTCFullYear();
    const month = prevMonth.getUTCMonth() + 1;
    const schedules = await ctx.runQuery(internal.reports.getEnabledSchedules, {});
    for (const schedule of schedules) {
      try {
        await sendDelivery(ctx, { scheduleId: schedule._id, year, month });
      } catch (error: unknown) {
        console.error("Zamanlanmış rapor işlenemedi", schedule._id, error);
      }
    }
  },
});
