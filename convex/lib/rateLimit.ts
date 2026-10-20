import { RateLimiter, HOUR, MINUTE } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const limiter = new RateLimiter(components.rateLimiter, {
  // Token bucket bounds bursts and replenishes without a permanent lockout.
  employeeSignIn: { kind: "token bucket", rate: 5, period: 15 * MINUTE, capacity: 5 },
  employeePasswordChange: { kind: "token bucket", rate: 5, period: 15 * MINUTE, capacity: 5 },
  register: { kind: "fixed window", rate: 5, period: HOUR },
  // E-posta doğrulama maili gönderimi (resend dahil) için ayrı bucket —
  // proje oluşturma (register) ile aynı kotayı tüketmesin.
  emailVerify: { kind: "fixed window", rate: 5, period: HOUR },
  inviteCreate: { kind: "fixed window", rate: 20, period: HOUR },
});
