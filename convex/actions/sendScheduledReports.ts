"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

import { trCalendarDate } from "../lib/trDate";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

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
    const prevMonth = trCalendarDate(new Date().toISOString());
    prevMonth.setUTCDate(1);
    prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
    const year = prevMonth.getUTCFullYear();
    const month = prevMonth.getUTCMonth() + 1;

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

        const html = `
          <h2>NGS Access - Aylık Rapor Özeti</h2>
          <p>${escapeHtml(reportSummary.title)}</p>
          <p>${escapeHtml(reportSummary.summary)}</p>
          <p>Raporu indirmek için <a href="${process.env.CONVEX_SITE_URL ?? "https://app.ngsaccess.com"}/settings">Ayarlar → Raporlar</a> bölümüne gidin.</p>
          <p>NGS Access PDKS</p>
        `;

        const sent = await sendEmail(s.email, `${reportSummary.title} — ${year}/${month}`, html);
        if (sent) await ctx.runMutation(internal.reports.markReportSent, { scheduleId: s._id });
        else console.error("Zamanlanmış rapor gönderilemedi", s._id);
      } catch (error: unknown) {
        console.error("Zamanlanmış rapor gönderilemedi", s._id, error);
      }
    }
  },
});
