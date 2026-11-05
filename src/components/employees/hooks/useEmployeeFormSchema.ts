import { z } from "zod";
import { isValidTurkishIdentityNumber } from "../../../../convex/lib/employeeImportValidation";
import { TC_NO_INVALID_MESSAGE } from "../../../../convex/lib/employeeUx";

const EMAIL_SCHEMA = z.email();

export const employeeFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Ad alanı zorunludur"),
    lastName: z.string().trim().min(1, "Soyad alanı zorunludur"),
    // İsteğe bağlı: cihazdan aktarılan kişiler e-postasız gelir; doluysa biçim denetlenir.
    email: z.string().trim().refine(value => !value || EMAIL_SCHEMA.safeParse(value).success, "Geçerli bir e-posta adresi girin"),
    tcNo: z.string().optional(),
    cardNumber: z.string().trim().min(1, "Kart numarası zorunludur"),
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
  })
  .superRefine((data, ctx) => {
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

export type EmployeeFormSchemaInput = z.infer<typeof employeeFormSchema>;
