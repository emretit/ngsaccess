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
  selected_doors: z.array(z.string()),
  accessExpiresAt: z.string(),
}).superRefine((data, ctx) => {
  if ((!data.isEditing || data.isPreRegistration) && !data.selected_doors.length) ctx.addIssue({ code: "custom", path: ["doors"], message: "Ziyaretçinin geçeceği en az bir kapı seçin" });
  if (!data.isEditing || data.accessExpiresAt !== data.originalExpiry || (data.isActive && !data.wasActive)) {
    const error = visitorExpiryValidation(data.accessExpiresAt);
    if (error) ctx.addIssue({ code: "custom", path: ["accessExpiresAt"], message: error });
  }
  if (((!data.isEditing || data.isPreRegistration || data.isActive !== false) && !data.cardNumber) || isVisitorCardPlaceholder(data.cardNumber)) {
    ctx.addIssue({ code: "custom", path: ["cardNumber"], message: "Geçerli yeni bir kart numarası girin" });
  }
});

export type VisitorFormSchemaInput = z.infer<typeof visitorFormSchema>;
