"use node";

import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { deliverProjectMail } from "../lib/projectMailer";

type SendResult = { ok: true } | { ok: false; reason: "NO_EMAIL" | "MAIL_NOT_CONFIGURED" | "PASS_MISMATCH" | "SEND_FAILED" };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
function formatDate(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" }).format(time) : "Belirtilmedi";
}

export const send = action({
  args: { visitorId: v.id("employees"), token: v.string(), pin: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), reason: v.union(
    v.literal("NO_EMAIL"), v.literal("MAIL_NOT_CONFIGURED"), v.literal("PASS_MISMATCH"), v.literal("SEND_FAILED"),
  ) })),
  handler: async (ctx, args): Promise<SendResult> => {
    const projectId = await ctx.runQuery(internal.visitorPassMailData.projectForVisitor, { visitorId: args.visitorId });
    if (!/^NGSV1\.[A-Za-z0-9_-]{22}$/.test(args.token) || !/^\d{6}$/.test(args.pin)) return { ok: false, reason: "PASS_MISMATCH" };
    const prepared = await ctx.runQuery(internal.visitorPassMailData.prepare, {
      visitorId: args.visitorId, tokenHash: digest(args.token), pinHash: digest(`${projectId}:${args.pin}`),
    });
    if (!prepared.ok) return prepared;
    const smtp = await ctx.runQuery(internal.mailSettings.getForDelivery, { projectId });
    if (!smtp && !process.env.RESEND_API_KEY) return { ok: false, reason: "MAIL_NOT_CONFIGURED" };
    try {
      const png = await QRCode.toBuffer(args.token, { type: "png", errorCorrectionLevel: "M", margin: 4, width: 384 });
      const delivered = await deliverProjectMail(ctx, projectId, {
        to: prepared.email, subject: "Ziyaretçi geçiş kodunuz",
        html: `<p>Sayın ${escapeHtml(prepared.name)},</p><p>Ziyaretçi QR kodunuz PNG olarak ektedir.</p><p>PIN: <strong>${args.pin}</strong></p><p>Geçerlilik: ${escapeHtml(formatDate(prepared.startsAt))} – ${escapeHtml(formatDate(prepared.expiresAt))}</p><p>Kapılar: ${escapeHtml(prepared.doors.join(", ") || "Resepsiyon")}</p>`,
        attachments: [{ filename: "ziyaretci-qr.png", content: png, contentType: "image/png" }],
      });
      if (!delivered.ok) return { ok: false, reason: "SEND_FAILED" };
      await ctx.runMutation(internal.visitorPassMailData.recordSent, { visitorId: args.visitorId, passId: prepared.passId });
      return { ok: true };
    } catch {
      // Never log transport exceptions: provider payloads can contain the QR/PIN.
      return { ok: false, reason: "SEND_FAILED" };
    }
  },
});
