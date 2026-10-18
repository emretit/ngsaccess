import { z } from "zod";
export const generalSchema = z.object({
  companyName: z.string().trim().min(1, "Şirket adı boş bırakılamaz"),
  taxNumber: z.string(), address: z.string(),
  email: z.union([z.literal(""), z.string().trim().email("Geçerli bir e-posta adresi girin")]),
  phone: z.string(), website: z.string(), currency: z.string(),
  darkMode: z.boolean(), notifications: z.boolean(),
});
export type GeneralValues = z.infer<typeof generalSchema>;
export function generalPayload(values: GeneralValues) {
  return { companyName: values.companyName.trim(), taxNumber: values.taxNumber.trim() || null,
    address: values.address.trim() || null, email: values.email.trim() || null,
    phone: values.phone.trim() || null, website: values.website.trim() || null,
    currency: values.currency || null, darkMode: values.darkMode, notificationsEnabled: values.notifications };
}
