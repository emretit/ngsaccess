// Ortak NGS+ e-posta iskeleti (davet, doğrulama, rapor, test maili). Saf string; runtime bağımsız.

/**
 * GÜVENLIK: heading, body ve footerNote içine kullanıcı kontrolündeki tüm değerler
 * (isim, şirket adı, vb.) buraya gelmeden önce escapeHtml() ile escape edilmeli.
 * Template'in kendi sabit HTML iskeletindeki değerler escape edilmez.
 * ctaUrl server-controlled olmalı (kullanıcı inputu KABUL ETMEz).
 */
export interface EmailTemplateParams {
  title: string;
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  securityNote?: string;
  footerNote?: string;
}

export function renderEmailTemplate(p: EmailTemplateParams): string {
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
