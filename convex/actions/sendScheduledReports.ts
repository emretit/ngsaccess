"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

import { trCalendarDate } from "../lib/trDate";
import { escapeHtml } from "../lib/escapers";
import { renderEmailTemplate } from "../lib/emailTemplate";
import { deliverProjectMail } from "../lib/projectMailer";

export const sendMonthlyReports = internalAction({
  args: {},
  handler: async (ctx) => {
    const prevMonth = trCalendarDate(new Date().toISOString());
    prevMonth.setUTCDate(1);
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    const year = prevMonth.getUTCFullYear();
    const month = prevMonth.getUTCMonth() + 1;
    const site = process.env.SITE_URL ?? "https://ngsplus.app";

    const schedules = await ctx.runQuery(internal.reports.getEnabledSchedules, {});

    for (const s of schedules) {
      try {
        const reportSummary =
          await ctx.runQuery(internal.reports.getReportSummaryForEmail, {
            scheduleId: s._id,
            year,
            month,
          });
        if (!reportSummary) continue;

        const subject = `${reportSummary.title} — ${year}/${month}`;
        const html = renderEmailTemplate({
          title: escapeHtml(subject),
          heading: "Aylık rapor özeti",
          body: `<strong>${escapeHtml(reportSummary.title)}</strong><br/>${escapeHtml(reportSummary.summary)}`,
          ctaUrl: `${site}/settings?tab=reports`,
          ctaLabel: "Ayarlar → Raporlar",
          footerNote: "Bu e-posta Ayarlar › Raporlar › Kişisel e-posta hatırlatması açık olduğu için gönderildi.",
        });

        // Proje SMTP hesabı (müşterinin kendi posta kutusu) varsa ondan, yoksa NGS+ varsayılanından.
        const sent = await deliverProjectMail(ctx, s.projectId, { to: s.email, subject, html });
        if (sent.ok) await ctx.runMutation(internal.reports.markReportSent, { scheduleId: s._id });
        else console.error("Zamanlanmış rapor gönderilemedi", s._id, sent.channel, sent.error);
      } catch (error: unknown) {
        console.error("Zamanlanmış rapor gönderilemedi", s._id, error);
      }
    }
  },
});
