import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from "../../../convex/lib/passwordPolicy";
import { z } from "zod";

export const emailSchema = z.string().trim().email("Geçerli bir e-posta adresi girin.");
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifrenizi girin."),
});
export const registrationSchema = loginSchema.extend({
  firstName: z.string().trim().min(1, "Adınızı girin."),
  lastName: z.string().trim().min(1, "Soyadınızı girin."),
  companyName: z.string().trim().min(1, "Firma adını girin."),
  password: z.string().refine(isPasswordValid, PASSWORD_POLICY_MESSAGE),
});

export function fieldMessages(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(error.issues.map(issue => [String(issue.path[0]), issue.message]));
}
