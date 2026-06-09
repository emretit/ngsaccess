"use node";

import { internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { authedAction } from "../lib/customFunctions";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface ResendResponse {
  id?: string;
  error?: { message: string };
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY ayarlı değil — email gönderilemedi");
    return {
      success: false,
      error: "Mail servisi yapılandırılmamış (RESEND_API_KEY eksik)",
    };
  }

  const defaultFromEmail = process.env.MAIL_FROM_EMAIL ?? "noreply@ngsplus.app";
  const defaultFromName = process.env.MAIL_FROM_NAME ?? "NGS+";
  const from = params.fromEmail
    ? `${params.fromName ?? defaultFromName} <${params.fromEmail}>`
    : `${defaultFromName} <${defaultFromEmail}>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  const data = (await response.json()) as ResendResponse;
  if (!response.ok || data.error) {
    return { success: false, error: data.error?.message ?? "Email gönderilemedi" };
  }
  return { success: true };
}

/**
 * Kullanıcı kontrollü string'leri HTML-escape eder. Email template'lerine
 * interpolate edilen isim/firma gibi alanlara uygulanır; aksi halde
 * project_admin gibi roller çalışan adına <a href> enjekte edip Resend
 * altyapısından phishing maili gönderebilir (HTML injection).
 * NOT: Template'in kendi sabit HTML iskeleti escape EDİLMEZ — yalnızca
 * dışarıdan gelen değerler. body içinde kasıtlı <strong>/<br/> kullanan
 * çağrılar, dinamik kısmı önce escape edip sonra markup ekler.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface EmailTemplateParams {
  title: string;
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  securityNote?: string;
  footerNote?: string;
}

function renderEmailTemplate(p: EmailTemplateParams): string {
  // CTA: bulletproof button (table + inline style). Mail client'larda gradient/class
  // genelde kırpılır; bu yüzden solid color + inline style + plain URL fallback.
  const cta = p.ctaUrl && p.ctaLabel
    ? `
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 24px auto;">
          <tr>
            <td align="center" bgcolor="#711A1A" style="background-color: #711A1A; border-radius: 8px;">
              <a href="${p.ctaUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${p.ctaLabel}</a>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 13px; color: #888; line-height: 1.5; text-align: center;">
          Buton görünmüyorsa şu adresi tarayıcınıza yapıştırın:<br/>
          <a href="${p.ctaUrl}" target="_blank" style="color: #711A1A; word-break: break-all;">${p.ctaUrl}</a>
        </p>`
    : "";
  const security = p.securityNote
    ? `<div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin: 24px 0 0; font-size: 14px; color: #856404; text-align: left;"><strong>Güvenlik:</strong> ${p.securityNote}</div>`
    : "";
  const footer = p.footerNote ?? "Bu e-postayı siz istemediyseniz güvenle yok sayabilirsiniz.";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${p.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" bgcolor="#f5f5f5" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="600" style="max-width: 600px; background: #ffffff; border-radius: 16px; overflow: hidden;">
          <tr>
            <td bgcolor="#711A1A" style="background-color: #711A1A; padding: 40px 30px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #ffffff;">NGS+</div>
              <p style="font-size: 16px; margin: 10px 0 0; color: #ffffff; opacity: 0.9;">Erişim Yönetim Sistemi</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: #ffffff;">
              <h1 style="font-size: 24px; color: #333333; margin: 0 0 20px; font-weight: 600;">${p.heading}</h1>
              <p style="font-size: 16px; color: #666666; line-height: 1.6; margin: 0 0 16px;">${p.body}</p>
              ${cta}
              ${security}
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="font-size: 14px; color: #6c757d; line-height: 1.5; margin: 0;">${footer}</p>
              <p style="font-size: 14px; color: #6c757d; line-height: 1.5; margin: 12px 0 0;"><strong>NGS+</strong> · Erişim Yönetim Sistemi</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const sendEmployeeSetupEmail = authedAction({
  args: {
    employeeId: v.id("employees"),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Yetki: caller, hedef employee'nin projesine erişebilmeli. employees.getById
    // authedQuery'dir ve erişilemeyen projede hata fırlatır → yetkisiz çağrı burada durur.
    // Bu olmadan anonim/yabancı bir caller setup token'ını kendi e-postasına yazıp
    // çalışan mobil hesabını ele geçirebilir (authorization_bypass).
    const employee = await ctx.runQuery(api.employees.getById, {
      employeeId: args.employeeId,
    });
    if (!employee) {
      return { success: false, error: "Çalışan bulunamadı veya erişim yetkiniz yok" };
    }

    const setupToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const existing = await ctx.runQuery(api.employeeAuth.getByEmployee, {
      employeeId: args.employeeId,
    });

    if (existing) {
      await ctx.runMutation(internal.employeeAuth.update, {
        authId: existing._id,
        email: args.email,
        setupToken,
        tokenExpiresAt: expiresAt,
      });
    } else {
      await ctx.runMutation(internal.employeeAuth.create, {
        employeeId: args.employeeId,
        projectId: args.projectId,
        email: args.email,
        setupToken,
        tokenExpiresAt: expiresAt,
      });
    }

    const baseUrl = process.env.SITE_URL ?? "https://ngsplus.app";
    const setupUrl = `${baseUrl}/employee-setup?token=${setupToken}`;

    const html = renderEmailTemplate({
      title: "NGS+ — Hesap Aktivasyonu",
      heading: `Merhaba ${escapeHtml(args.firstName)} ${escapeHtml(args.lastName)} 👋`,
      body: "NGS+ mobil uygulaması için şifrenizi belirleyin. Aşağıdaki butona tıklayarak hesabınızı aktif edebilirsiniz.",
      ctaUrl: setupUrl,
      ctaLabel: "Hesabı Aktif Et",
      securityNote: "Bu link 7 gün geçerlidir. Eğer bu daveti siz beklemiyorsanız bu e-postayı yok sayabilirsiniz.",
    });

    return await sendResendEmail({
      to: args.email,
      subject: "NGS+ — Hesap Aktivasyonu",
      html,
    });
  },
});

/**
 * Yetkili kullanıcı (super_admin / proje sahibi / proje admin) bir kullanıcıyı
 * projeye davet eder. invites.create ile token üretilir, kullanıcıya pafta tarzı
 * kart maili gider; link /user-setup?token=xxx üzerinden şifre belirletir.
 *
 * type === "reset" parametresi gelecek için hazır (mevcut kullanıcıya şifre
 * sıfırlama maili) — şu an UI'dan tetiklenmiyor.
 */
const ROLE_LABELS_TR: Record<"project_admin" | "project_user", string> = {
  project_admin: "Proje Yöneticisi",
  project_user: "Kullanıcı",
};

export const sendUserInviteEmail = authedAction({
  args: {
    email: v.string(),
    projectId: v.id("projects"),
    role: v.union(v.literal("project_admin"), v.literal("project_user")),
    type: v.optional(v.union(v.literal("invite"), v.literal("reset"))),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const inviteType = args.type ?? "invite";

    // invites.create kendi içinde yetki kontrolü yapar (super_admin/owner/project_admin),
    // ama bu action artık authedAction olduğundan anonim caller buraya hiç ulaşamaz.
    const token: string = await ctx.runMutation(api.invites.create, {
      email: args.email,
      projectId: args.projectId,
      role: args.role,
      type: inviteType,
    });

    const project = await ctx.runQuery(api.projects.getById, {
      projectId: args.projectId,
    });
    // projectName kullanıcı kontrollü (firma/proje adı) → email'e ham basılırsa HTML
    // injection olur; escape et.
    const projectName = escapeHtml(project?.name ?? "NGS+");

    const baseUrl = process.env.SITE_URL ?? "https://ngsplus.app";
    const setupUrl = `${baseUrl}/user-setup?token=${token}`;

    const isReset = inviteType === "reset";
    const subject = isReset
      ? `NGS+ — Şifre sıfırlama bağlantısı`
      : `${project?.name ?? "NGS+"} — NGS+ davetiniz`;
    const heading = isReset ? "Şifrenizi sıfırlayın" : "NGS+'a davet edildiniz 👋";
    const roleLabel = ROLE_LABELS_TR[args.role];
    const body = isReset
      ? `<strong>${projectName}</strong> hesabınız için yeni şifre belirlemeniz isteniyor. Aşağıdaki butona tıklayarak yeni şifrenizi oluşturabilirsiniz.`
      : `<strong>${projectName}</strong> projesine <strong>${roleLabel}</strong> olarak davet edildiniz. Hesabınızı oluşturmak ve şifrenizi belirlemek için aşağıdaki butona tıklayın.`;
    const ctaLabel = isReset ? "Şifre Sıfırla" : "Hesabı Aktif Et";

    const html = renderEmailTemplate({
      title: subject,
      heading,
      body,
      ctaUrl: setupUrl,
      ctaLabel,
      securityNote: "Bu link 7 gün geçerlidir. Eğer bu maili siz beklemiyorsanız yok sayabilirsiniz.",
    });

    return await sendResendEmail({
      to: args.email,
      subject,
      html,
    });
  },
});

// internalAction: yalnızca scheduler/internal'dan çağrılır (cardReadings PDKS akışı).
// Public action olarak açık kalırsa anonim caller keyfi alıcıya mail attırabilir.
export const sendLateNotification = internalAction({
  args: {
    to: v.string(),
    employeeName: v.string(),
    lateTime: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; error?: string }> => {
    // employeeName/lateTime kullanıcı kontrollü → markup'a girmeden önce escape.
    const safeName = escapeHtml(args.employeeName);
    const safeTime = escapeHtml(args.lateTime);
    const html = renderEmailTemplate({
      title: "NGS+ PDKS — Geç Kalma Bildirimi",
      heading: "Geç Kalma Bildirimi",
      body: `<strong>${safeName}</strong> çalışanı işe geç kalmıştır.<br/>Giriş saati: <strong>${safeTime}</strong>`,
      footerNote: "Lütfen NGS+ PDKS panelinden detayları kontrol ediniz.",
    });
    return await sendResendEmail({
      to: args.to,
      subject: `PDKS — Geç Kalma: ${args.employeeName}`,
      html,
    });
  },
});

/**
 * Self-signup sonrası e-posta doğrulama maili.
 * Maildeki "Hesabı Doğrula" butonu SITE_URL/verify-email?token=... adresine gider.
 */
// internalAction: yalnızca emailVerification (signUp sonrası scheduler) çağırır.
export const sendVerificationEmail = internalAction({
  args: {
    to: v.string(),
    token: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; error?: string }> => {
    const baseUrl = process.env.SITE_URL ?? "https://ngsplus.app";
    const verifyUrl = `${baseUrl}/verify-email?token=${args.token}`;
    // name kullanıcı kontrollü → escape.
    const greeting = args.name ? `Hoş geldiniz, ${escapeHtml(args.name)}!` : "Hoş geldiniz!";

    const html = renderEmailTemplate({
      title: "NGS+ — Hesabınızı doğrulayın",
      heading: greeting,
      body: "NGS+ hesabınızı etkinleştirmek için aşağıdaki butona tıklayın. Doğrulama tamamlanmadan giriş yapamazsınız.",
      ctaUrl: verifyUrl,
      ctaLabel: "Hesabı Doğrula",
      securityNote: "Bu link 24 saat geçerlidir. Eğer bu kaydı siz yapmadıysanız bu maili yok sayabilirsiniz.",
    });

    return await sendResendEmail({
      to: args.to,
      subject: "NGS+ — Hesabınızı doğrulayın",
      html,
    });
  },
});
