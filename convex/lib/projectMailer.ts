"use node";

import nodemailer from "nodemailer";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { decryptMailSecret, mailSecretAad } from "./mailSecret";
import { describeSmtpError, smtpErrorFields, type ProjectSmtpConfig } from "./smtpConfig";

// Proje maili gönderim katmanı: aktif proje SMTP hesabı varsa (müşterinin Google Workspace vb.
// posta kutusu) ondan, yoksa NGS+ varsayılan sağlayıcısından (Resend) gönderir.
// SMTP hatasında Resend'e sessizce düşülmez: müşteri kendi adresini seçti, hata görünür kalır.

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
}

export type MailChannel = "smtp" | "resend";
export type MailDelivery = { ok: true; channel: MailChannel } | { ok: false; channel: MailChannel; error: string };

export async function sendViaProjectSmtp(projectId: Id<"projects">, config: ProjectSmtpConfig, mail: OutgoingMail): Promise<MailDelivery> {
  let password: string;
  try {
    password = await decryptMailSecret(config.passwordEnc, mailSecretAad(projectId));
  } catch (error: unknown) {
    return { ok: false, channel: "smtp", error: error instanceof Error ? error.message : "Kayıtlı SMTP şifresi çözülemedi" };
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.username, pass: password },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    tls: { minVersion: "TLSv1.2", servername: config.host },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    await transport.sendMail({
      from: { name: config.fromName || "NGS+", address: config.fromEmail },
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
    });
    return { ok: true, channel: "smtp" };
  } catch (error: unknown) {
    const { code, responseCode } = smtpErrorFields(error);
    console.error("Proje SMTP gönderimi başarısız", projectId, config.host, code, responseCode);
    return { ok: false, channel: "smtp", error: describeSmtpError(error, config.host) };
  } finally {
    transport.close();
  }
}

export async function sendViaDefaultProvider(mail: OutgoingMail): Promise<MailDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, channel: "resend", error: "E-posta servisi yapılandırılmamış (RESEND_API_KEY eksik)" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${process.env.MAIL_FROM_NAME ?? "NGS+"} <${process.env.MAIL_FROM_EMAIL ?? "noreply@ngsplus.app"}>`,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok ? { ok: true, channel: "resend" } : { ok: false, channel: "resend", error: `E-posta servisi HTTP ${response.status} hatası verdi` };
  } catch {
    return { ok: false, channel: "resend", error: "E-posta servisine ulaşılamadı" };
  }
}

/** projectId yoksa (ör. "tüm projeler" kapsamlı rapor) varsayılan sağlayıcı kullanılır. */
export async function deliverProjectMail(ctx: ActionCtx, projectId: Id<"projects"> | undefined, mail: OutgoingMail): Promise<MailDelivery> {
  if (!projectId) return await sendViaDefaultProvider(mail);
  const config = await ctx.runQuery(internal.mailSettings.getForDelivery, { projectId });
  return config ? await sendViaProjectSmtp(projectId, config, mail) : await sendViaDefaultProvider(mail);
}
