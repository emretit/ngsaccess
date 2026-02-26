"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

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
    console.warn("RESEND_API_KEY ayarlı değil, email gönderimi atlanıyor");
    return { success: true };
  }

  const from = params.fromEmail
    ? `${params.fromName ?? "NGS Access"} <${params.fromEmail}>`
    : "NGS Access <noreply@ngsaccess.com>";

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

export const sendEmployeeSetupEmail = action({
  args: {
    employeeId: v.id("employees"),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const setupToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Mevcut auth kaydını güncelle veya yeni oluştur
    const existing = await ctx.runQuery(api.employeeAuth.getByEmployee, {
      employeeId: args.employeeId,
    });

    if (existing) {
      await ctx.runMutation(api.employeeAuth.update, {
        authId: existing._id,
        email: args.email,
        setupToken,
        tokenExpiresAt: expiresAt,
      });
    } else {
      await ctx.runMutation(api.employeeAuth.create, {
        employeeId: args.employeeId,
        projectId: args.projectId,
        email: args.email,
        setupToken,
        tokenExpiresAt: expiresAt,
      });
    }

    const setupUrl = `${process.env.CONVEX_SITE_URL ?? "http://localhost:5173"}/employee-setup?token=${setupToken}`;

    const html = `
      <h2>Merhaba ${args.firstName} ${args.lastName},</h2>
      <p>NGS Access sistemine hoş geldiniz. Hesabınızı aktif etmek için aşağıdaki linke tıklayın:</p>
      <p><a href="${setupUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Hesabı Aktif Et</a></p>
      <p>Bu link 7 gün geçerlidir.</p>
      <p>NGS Access Ekibi</p>
    `;

    return await sendResendEmail({
      to: args.email,
      subject: "NGS Access - Hesap Aktivasyonu",
      html,
    });
  },
});

export const sendUserSetupEmail = action({
  args: {
    userId: v.id("users"),
    email: v.string(),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const setupToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await ctx.runMutation(api.users.setupUser, {
      userId: args.userId,
      role: "project_user",
      fullName: args.fullName,
    });

    const setupUrl = `${process.env.CONVEX_SITE_URL ?? "http://localhost:5173"}/user-setup?token=${setupToken}`;

    const html = `
      <h2>Merhaba ${args.fullName ?? args.email},</h2>
      <p>NGS Access yönetim paneline erişim sağlandı. Aşağıdaki link ile şifrenizi belirleyin:</p>
      <p><a href="${setupUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Şifre Belirle</a></p>
      <p>Bu link 24 saat geçerlidir.</p>
      <p>NGS Access Ekibi</p>
    `;

    return await sendResendEmail({
      to: args.email,
      subject: "NGS Access - Yönetim Paneli Erişimi",
      html,
    });
  },
});
