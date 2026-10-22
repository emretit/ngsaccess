"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { escapeHtml } from "../lib/escapers";

export const send = internalAction({
  args: { eventId: v.id("deviceEvents"), attempt: v.optional(v.number()) },
  handler: async (ctx, args): Promise<null> => {
    const attempt = args.attempt ?? 1;
    const payload = await ctx.runMutation(internal.alarms.claimEmail, { eventId: args.eventId, attempt });
    if (!payload) return null;
    const failedRecipients: string[] = [];
    let error: string | undefined;
    const apiKey = process.env.RESEND_API_KEY;
    const site = process.env.SITE_URL ?? "https://ngsplus.app";
    const device = payload.device?.name ?? "Cihaz";
    const time = new Date(payload.event.eventTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
    for (const recipient of payload.recipients) {
      if (!apiKey) {
        failedRecipients.push(recipient); error = "E-posta servisi yapılandırılmamış";
        continue;
      }
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `alarm-${args.eventId}-${attempt}-${payload.recipients.indexOf(recipient)}` },
          body: JSON.stringify({
            from: `${process.env.MAIL_FROM_NAME ?? "NGS+"} <${process.env.MAIL_FROM_EMAIL ?? "noreply@ngsplus.app"}>`, to: [recipient],
            subject: payload.event.alarmEmailTest ? "NGS+ — Alarm test e-postası" : `NGS+ — ${payload.event.severity === "critical" ? "Kritik alarm" : "Alarm bildirimi"}`,
            html: `<p><strong>${escapeHtml(device)}</strong> · ${escapeHtml(payload.event.label)}</p><p>Önem: ${escapeHtml(payload.event.severity)}<br>Zaman: ${escapeHtml(time)}</p>${payload.event.resolvedAt ? "<p>Bağlantı geri geldi; çevrimdışı dönemi kapandı.</p>" : ""}<p><a href="${escapeHtml(site)}/alarms">Alarmlar sayfasına git</a></p>`,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) { failedRecipients.push(recipient); error = `E-posta servisi HTTP ${response.status} hatası verdi`; }
      } catch {
        failedRecipients.push(recipient); error = "E-posta servisine ulaşılamadı";
      }
    }
    await ctx.runMutation(internal.alarms.recordEmailResult, { eventId: args.eventId, attempt, failedRecipients, error });
    return null;
  },
});
