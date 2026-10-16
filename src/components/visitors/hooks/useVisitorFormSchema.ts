import { z } from "zod";

export const visitorFormSchema = z.object({
  firstName: z.string().trim().min(1, "Ad alanı zorunludur"),
  lastName: z.string().trim().min(1, "Soyad alanı zorunludur"),
  cardNumber: z.string().trim(),
  isActive: z.boolean().optional(),
  isEditing: z.boolean().optional(),
  presetRuleId: z.string({ error: "Ziyaretçi bölgesi seçin" }).min(1, "Ziyaretçi bölgesi seçin"),
  accessExpiresAt: z.string().min(1, "Geçerlilik bitiş zamanı zorunludur").refine((value) => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now(), "Geçerlilik bitişi gelecekte olmalıdır"),
}).superRefine((data, ctx) => {
  if (((!data.isEditing || data.isActive !== false) && !data.cardNumber) || data.cardNumber.startsWith("IADE:")) {
    ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Geçerli yeni bir kart numarası girin" });
  }
});

export type VisitorFormSchemaInput = z.infer<typeof visitorFormSchema>;
