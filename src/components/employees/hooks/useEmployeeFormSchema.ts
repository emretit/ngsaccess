import { z } from "zod";

const TC_REGEX = /^[1-9]\d{10}$/;

export const employeeFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Ad alanı zorunludur"),
    lastName: z.string().trim().min(1, "Soyad alanı zorunludur"),
    email: z.string().trim().email("Geçerli bir e-posta adresi girin"),
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
  })
  .superRefine((data, ctx) => {
    if (data.tcNo && data.tcNo.trim()) {
      const trimmed = data.tcNo.trim();
      if (!TC_REGEX.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "TC Kimlik No 11 haneli olmalı ve geçerli formatta olmalıdır",
          path: ["tcNo"],
        });
      }
    }
  });

export type EmployeeFormSchemaInput = z.infer<typeof employeeFormSchema>;
