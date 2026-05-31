import { z } from "zod";

export const visitorFormSchema = z.object({
  firstName: z.string().min(1, "Ad alanı zorunludur"),
  lastName: z.string().min(1, "Soyad alanı zorunludur"),
  cardNumber: z.string().min(1, "Kart numarası zorunludur"),
  presetRuleId: z.string().min(1, "Ziyaretçi bölgesi seçin"),
  accessExpiresAt: z.string().min(1, "Geçerlilik bitiş zamanı zorunludur"),
});

export type VisitorFormSchemaInput = z.infer<typeof visitorFormSchema>;
