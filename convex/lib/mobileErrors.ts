import { ConvexError, v } from "convex/values";

export const mobileErrorCode = v.union(
  v.literal("SESSION_INVALID"),
  v.literal("SESSION_EXPIRED"),
  v.literal("SESSION_REVOKED"),
  v.literal("EMPLOYEE_INACTIVE"),
  v.literal("EMPLOYMENT_ENDED"),
  v.literal("INVALID_CREDENTIALS"),
  v.literal("RATE_LIMITED"),
);

export type MobileErrorCode = typeof mobileErrorCode.type;

const messages: Record<MobileErrorCode, string> = {
  SESSION_INVALID: "Oturum geçersiz",
  SESSION_EXPIRED: "Oturum süresi doldu",
  SESSION_REVOKED: "Oturum iptal edildi; yeniden giriş yapın",
  EMPLOYEE_INACTIVE: "Çalışan aktif değil",
  EMPLOYMENT_ENDED: "İşten ayrıldığınız için mobil erişiminiz kapatıldı",
  INVALID_CREDENTIALS: "E-posta veya şifre hatalı",
  RATE_LIMITED: "Çok fazla giriş denemesi; lütfen bekleyin",
};

export function mobileErrorData<Code extends MobileErrorCode>(code: Code, retryAfterMs?: number) {
  return {
    code,
    message: messages[code],
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
  };
}

export function mobileError(code: MobileErrorCode): ConvexError<ReturnType<typeof mobileErrorData>> {
  return new ConvexError(mobileErrorData(code));
}
