"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "NGS Access <noreply@ngsaccess.com>",
      to: [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

export const sendMonthlyReports = internalAction({
  args: {},
  handler: async (ctx) => {
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const year = prevMonth.getFullYear();
    const month = prevMonth.getMonth() + 1;

    const schedules = await ctx.runQuery(internal.reports.getEnabledSchedules, {});

    for (const s of schedules) {
      const reportSummary =
        (await ctx.runQuery(internal.reports.getReportSummaryForEmail, {
          reportType: s.reportType,
          year,
          month,
          userId: s.userId,
        })) ?? { title: "Aylık Rapor", summary: "Rapor hazır." };

      const html = `
        <h2>NGS Access - Aylık Rapor Özeti</h2>
        <p>${reportSummary.title}</p>
        <p>${reportSummary.summary}</p>
        <p>Raporu indirmek için <a href="${process.env.CONVEX_SITE_URL ?? "https://app.ngsaccess.com"}/settings">Ayarlar → Raporlar</a> bölümüne gidin.</p>
        <p>NGS Access PDKS</p>
      `;

      await sendEmail(s.email, `PDKS Aylık Rapor - ${year}/${month}`, html);
      await ctx.runMutation(internal.reports.markReportSent, { scheduleId: s._id });
    }
  },
});
