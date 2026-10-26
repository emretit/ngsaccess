"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { authedAction } from "../lib/customFunctions";
import { encryptMailSecret, mailSecretAad } from "../lib/mailSecret";
import { isValidEmailAddress, normalizeSmtpConfig } from "../lib/smtpConfig";
import { renderEmailTemplate } from "../lib/emailTemplate";
import { escapeHtml } from "../lib/escapers";
import { sendViaProjectSmtp } from "../lib/projectMailer";

/** Proje SMTP hesabını kaydeder; yetki internal mutation'da yeniden denetlenir. */
export const save = authedAction({
  args: {
    projectId: v.id("projects"),
    host: v.string(),
    port: v.number(),
    username: v.string(),
    fromEmail: v.string(),
    fromName: v.optional(v.string()),
    isActive: v.boolean(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<null> => {
    const config = normalizeSmtpConfig({ ...args, password: args.password || undefined });
    const passwordEnc = config.password ? await encryptMailSecret(config.password, mailSecretAad(args.projectId)) : undefined;
    await ctx.runMutation(internal.mailSettings.upsertForCaller, {
      callerId: ctx.user._id, projectId: args.projectId, host: config.host, port: config.port, secure: config.secure,
      username: config.username, fromEmail: config.fromEmail, fromName: config.fromName, isActive: config.isActive, passwordEnc,
    });
    return null;
  },
});

/** Kayıtlı hesapla (pasif olsa da) test maili gönderir; sonuç doğrudan ekrana döner. */
export const sendTest = authedAction({
  args: { projectId: v.id("projects"), to: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ ok: boolean; error?: string; to: string }> => {
    const config = await ctx.runQuery(internal.mailSettings.getForCaller, { callerId: ctx.user._id, projectId: args.projectId });
    if (!config) throw new ConvexError("Önce SMTP hesabını kaydedin.");
    const to = (args.to ?? ctx.user.email ?? "").trim();
    if (!isValidEmailAddress(to)) throw new ConvexError("Test maili için geçerli bir alıcı adresi girin.");
    const html = renderEmailTemplate({
      title: "NGS+ — SMTP test e-postası",
      heading: "SMTP bağlantınız çalışıyor",
      body: `Bu e-posta <strong>${escapeHtml(config.fromEmail)}</strong> hesabından <strong>${escapeHtml(config.host)}</strong> sunucusu üzerinden gönderildi. Aylık rapor e-postaları ${config.isActive ? "bu hesaptan gidecek" : "hesap etkinleştirildiğinde bu hesaptan gidecek"}.`,
      footerNote: "Bu test e-postası NGS+ Ayarlar › E-posta gönderimi bölümünden gönderildi.",
    });
    const result = await sendViaProjectSmtp(args.projectId, config, { to, subject: "NGS+ — SMTP test e-postası", html });
    return result.ok ? { ok: true, to } : { ok: false, error: result.error, to };
  },
});
