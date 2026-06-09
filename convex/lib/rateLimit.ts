import { RateLimiter, HOUR } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const limiter = new RateLimiter(components.rateLimiter, {
  register: { kind: "fixed window", rate: 5, period: HOUR },
  // E-posta doğrulama maili gönderimi (resend dahil) için ayrı bucket —
  // proje oluşturma (register) ile aynı kotayı tüketmesin.
  emailVerify: { kind: "fixed window", rate: 5, period: HOUR },
  inviteCreate: { kind: "fixed window", rate: 20, period: HOUR },
});
