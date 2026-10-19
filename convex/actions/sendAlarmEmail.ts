"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { shouldNotifyAlarm } from "../lib/alarmNotify";
import { escapeHtml } from "../lib/escapers";

export const send = internalAction({
  args: { eventId: v.id("deviceEvents") },
  handler: async (ctx, args) => {
    try {
      const payload = await ctx.runQuery(internal.alarms.emailPayload, { eventId: args.eventId });
      if (!payload || !shouldNotifyAlarm({ severity: payload.event.severity, minSeverity: payload.minSeverity, emailEnabled: true, sentRecently: payload.sentRecently })) return null;
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) { console.error("Alarm e-postası gönderilemedi: Resend yapılandırılmamış"); return null; }
      const site = process.env.SITE_URL ?? "https://ngsplus.app";
      const device = payload.device?.name ?? "Cihaz";
      const time = new Date(payload.event.eventTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
      for (const recipient of payload.recipients) {
        try {
          const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${process.env.MAIL_FROM_NAME ?? "NGS+"} <${process.env.MAIL_FROM_EMAIL ?? "noreply@ngsplus.app"}>`, to: [recipient], subject: `NGS+ — ${payload.event.severity === "critical" ? "Kritik alarm" : "Alarm bildirimi"}`, html: `<p><strong>${escapeHtml(device)}</strong> · ${escapeHtml(payload.event.label)}</p><p>Önem: ${escapeHtml(payload.event.severity)}<br>Zaman: ${escapeHtml(time)}</p><p><a href="${site}/alarms">Alarmlar sayfasına git</a></p>` }) });
          if (!response.ok) console.error("Alarm e-postası gönderilemedi:", response.status);
        } catch {
          console.error("Alarm e-postası gönderilemedi");
        }
      }
    } catch {
      console.error("Alarm e-postası gönderilirken hata oluştu");
    }
    return null;
  },
});
