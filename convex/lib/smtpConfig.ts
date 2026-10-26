import { ConvexError } from "convex/values";

// Proje SMTP hesabı = müşterinin kendi posta kutusu (Google Workspace/Gmail, hosting maili).
// Rapor maili bu hesaptan gider; hesap yoksa NGS+ varsayılan sağlayıcısı (Resend) kullanılır.
export const GOOGLE_SMTP_HOST = "smtp.gmail.com";
/** 465 = SSL (implicit TLS), 587 = STARTTLS. 25 bulut çıkışında kapalı olduğundan kabul edilmez. */
export const SMTP_PORTS = [465, 587] as const;

// TLD harf olmak zorunda: IP literal ve "localhost" gibi iç adresler reddedilir.
const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export interface SmtpConfigInput {
  host: string;
  port: number;
  username: string;
  fromEmail: string;
  fromName?: string;
  isActive: boolean;
  password?: string;
}

export interface NormalizedSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  isActive: boolean;
  password?: string;
}

/** Gönderim için saklanan hesap: normalize edilmiş alanlar + şifreli şifre (düz şifre asla taşınmaz). */
export type ProjectSmtpConfig = Omit<NormalizedSmtpConfig, "password"> & { passwordEnc: string };

export function isGoogleSmtpHost(host: string): boolean {
  return host.trim().toLowerCase() === GOOGLE_SMTP_HOST;
}

export function isValidEmailAddress(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value);
}

export function normalizeSmtpConfig(input: SmtpConfigInput): NormalizedSmtpConfig {
  const host = input.host.trim().toLowerCase();
  if (!HOSTNAME.test(host)) throw new ConvexError("Geçerli bir SMTP sunucu adı girin (örn. smtp.gmail.com).");
  if (!(SMTP_PORTS as readonly number[]).includes(input.port)) throw new ConvexError("SMTP portu 465 (SSL) veya 587 (STARTTLS) olmalıdır.");
  const username = input.username.trim();
  if (!username || username.length > 200 || /[\r\n]/.test(username)) throw new ConvexError("SMTP kullanıcı adını girin.");
  const fromEmail = input.fromEmail.trim().toLowerCase();
  if (!isValidEmailAddress(fromEmail)) throw new ConvexError("Geçerli bir gönderen e-posta adresi girin.");
  const fromName = (input.fromName ?? "").replace(/[\r\n<>"]/g, "").trim();
  if (fromName.length > 100) throw new ConvexError("Gönderen adı en fazla 100 karakter olabilir.");
  let password = input.password;
  if (password !== undefined) {
    // Google uygulama şifresini "abcd efgh ijkl mnop" diye gösterir; boşluklar şifrenin parçası değildir.
    if (isGoogleSmtpHost(host)) password = password.replace(/\s+/g, "");
    if (!password || password.length > 256 || /[\r\n]/.test(password)) throw new ConvexError("SMTP şifresini girin.");
  }
  return { host, port: input.port, secure: input.port === 465, username, fromEmail, fromName, isActive: input.isActive, password };
}

/**
 * Sunucu veya kullanıcı değişince kayıtlı şifre yeniden kullanılmaz: aksi halde şifreyi bilmeyen
 * bir yönetici host'u kendi sunucusuna çevirip kayıtlı şifreyi oraya gönderebilirdi.
 */
export function requiresNewPassword(
  existing: { smtpHost?: string; smtpUsername?: string; smtpPassword?: string } | null,
  next: { host: string; username: string },
): boolean {
  if (!existing?.smtpPassword) return true;
  return existing.smtpHost !== next.host || existing.smtpUsername !== next.username;
}

interface SmtpErrorLike {
  code?: string;
  responseCode?: number;
  message?: string;
}

export function smtpErrorFields(error: unknown): SmtpErrorLike {
  if (typeof error !== "object" || error === null) return {};
  const e = error as Record<string, unknown>;
  return {
    code: typeof e.code === "string" ? e.code : undefined,
    responseCode: typeof e.responseCode === "number" ? e.responseCode : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
  };
}

/** Kullanıcıya gösterilecek Türkçe hata; sunucu yanıtı (adres/şifre yansıtabilir) metne girmez. */
export function describeSmtpError(error: unknown, host: string): string {
  const { code, responseCode, message = "" } = smtpErrorFields(error);
  const tag = code ? ` [${code}${responseCode ? ` ${responseCode}` : ""}]` : "";
  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return (isGoogleSmtpHost(host)
      ? "Google kullanıcı adını veya şifreyi kabul etmedi. Normal Google şifresi çalışmaz; 16 haneli uygulama şifresi girin."
      : "SMTP sunucusu kullanıcı adını veya şifreyi kabul etmedi.") + tag;
  }
  if (code === "EDNS" || /ENOTFOUND|EAI_AGAIN/.test(message)) return `SMTP sunucu adı bulunamadı; sunucu adını kontrol edin.${tag}`;
  if (code === "ETLS" || /certificate|self[- ]signed|hostname/i.test(message)) return `Sunucunun TLS sertifikası doğrulanamadı; sağlayıcınızın verdiği SMTP sunucu adını kullanın.${tag}`;
  if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET" || /ECONNREFUSED|ECONNRESET|timeout/i.test(message)) {
    return `SMTP sunucusuna bağlanılamadı; sunucu adını ve portu kontrol edin.${tag}`;
  }
  if (code === "EENVELOPE" || (responseCode !== undefined && responseCode >= 550)) {
    return `Sunucu gönderimi reddetti; gönderen adresi bu hesaba ait olmayabilir.${tag}`;
  }
  return `E-posta SMTP ile gönderilemedi.${tag}`;
}
