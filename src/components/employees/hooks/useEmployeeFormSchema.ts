import { z } from "zod";
import { isValidTurkishIdentityNumber } from "../../../../convex/lib/employeeImportValidation";
import { cardKey, TC_NO_INVALID_MESSAGE } from "../../../../convex/lib/employeeUx";
import { cardNumberError } from "../../../../convex/lib/cardNumberRules";

const EMAIL_SCHEMA = z.email();

const employeeFormBase = z
  .object({
    firstName: z.string().trim().min(1, "Ad alanı zorunludur"),
    lastName: z.string().trim().min(1, "Soyad alanı zorunludur"),
    // İsteğe bağlı: cihazdan aktarılan kişiler e-postasız gelir; doluysa biçim denetlenir.
    email: z.string().trim().refine(value => !value || EMAIL_SCHEMA.safeParse(value).success, "Geçerli bir e-posta adresi girin"),
    tcNo: z.string().optional(),
    cardNumber: z.string().trim(),
    hourlyRate: z
      .number()
      .finite()
      .min(0, "Ücret negatif olamaz")
      .nullable()
      .optional(),
    monthlySalary: z
      .number()
      .finite()
      .min(0, "Ücret negatif olamaz")
      .nullable()
      .optional(),
    payrollCode: z.string().optional(),
    accessStartsAt: z.string().optional().refine(value => !value || (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value
    ), "Geçerli bir erişim başlangıcı tarihi girin"),
    accessExpiresAt: z.string().optional().refine(value => !value || (
      /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    ), "Geçerli bir erişim bitişi tarihi girin"),
  })
  .superRefine((data, ctx) => {
    if (data.accessStartsAt && data.accessExpiresAt && data.accessExpiresAt < data.accessStartsAt) {
      ctx.addIssue({ code: "custom", message: "Erişim bitişi başlangıçtan önce olamaz", path: ["accessExpiresAt"] });
    }
    if (data.tcNo && data.tcNo.trim()) {
      const trimmed = data.tcNo.trim();
      if (!isValidTurkishIdentityNumber(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: TC_NO_INVALID_MESSAGE,
          path: ["tcNo"],
        });
      }
    }
  });

function withCardValidation(existingCardNumber?: string) {
  return employeeFormBase.superRefine((data, ctx) => {
    // Imported credentials must not lock unrelated profile edits.
    if (existingCardNumber !== undefined && data.cardNumber === existingCardNumber.trim()) return;
    const message = cardNumberError(data.cardNumber, { allowEmpty: true });
    if (message) ctx.addIssue({ code: "custom", message, path: ["cardNumber"] });
  });
}
export const employeeFormSchema = withCardValidation();
export type EmployeeFormSchemaInput = z.infer<typeof employeeFormSchema>;

/** A card may be assigned later, but an existing credential cannot be removed here. */
export function employeeFormSchemaFor(existingCardNumber?: string) {
  return withCardValidation(existingCardNumber).refine(
    data => !existingCardNumber || !cardKey(existingCardNumber) || cardKey(data.cardNumber) !== undefined,
    { message: "Kart numarası zorunludur", path: ["cardNumber"] },
  );
}
