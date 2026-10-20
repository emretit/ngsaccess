import { z } from "zod";
import { visitorExpiryValidation } from "../../../../convex/lib/visitorStatus";
import { isVisitorCardPlaceholder } from "../lib/preRegistration";

export const visitorFormSchema = z.object({
  firstName: z.string().trim().min(1, "Ad alanı zorunludur"),
  lastName: z.string().trim().min(1, "Soyad alanı zorunludur"),
  cardNumber: z.string().trim(),
  isActive: z.boolean().optional(),
  isEditing: z.boolean().optional(),
  isPreRegistration: z.boolean().optional(),
  originalExpiry: z.string().optional(),
  wasActive: z.boolean().optional(),
  presetRuleId: z.string().nullable(),
  accessExpiresAt: z.string(),
}).superRefine((data, ctx) => {
  if ((!data.isEditing || data.isPreRegistration) && !data.presetRuleId) ctx.addIssue({ code: "custom", path: ["presetRuleId"], message: "Ziyaretçi erişim bölgesi seçin" });
  if (!data.isEditing || data.accessExpiresAt !== data.originalExpiry || (data.isActive && !data.wasActive)) {
    const error = visitorExpiryValidation(data.accessExpiresAt);
    if (error) ctx.addIssue({ code: "custom", path: ["accessExpiresAt"], message: error });
  }
  if (((!data.isEditing || data.isPreRegistration || data.isActive !== false) && !data.cardNumber) || isVisitorCardPlaceholder(data.cardNumber)) {
    ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Geçerli yeni bir kart numarası girin" });
  }
});

export type VisitorFormSchemaInput = z.infer<typeof visitorFormSchema>;
