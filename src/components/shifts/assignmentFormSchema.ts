import { validDay } from "../../../convex/lib/shiftUx";
import { z } from "zod";

export const bulkAssignmentFormSchema = z
  .object({
    employeeIds: z
      .array(z.string().min(1, "Çalışan seçin"))
      .min(1, "En az bir çalışan seçin")
      .max(100, "En fazla 100 çalışan seçin"),
    shiftId: z.string().min(1, "Vardiya seçin"),
    startDate: z.string().refine(validDay, "Başlangıç tarihi seçin"),
    endDate: z.string().refine(validDay, "Bitiş tarihi seçin"),
    specificDays: z.boolean(),
    weekPattern: z.array(
      z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
    ),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.employeeIds).size !== value.employeeIds.length)
      ctx.addIssue({
        code: "custom",
        path: ["employeeIds"],
        message: "Aynı çalışan birden fazla seçilemez",
      });
    if (value.startDate > value.endDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Bitiş tarihi başlangıçtan önce olamaz",
      });
    if (
      (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86400000 >
      365
    )
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Tarih farkı en fazla 365 gün olabilir (366 dahil gün)",
      });
    if (value.specificDays && !value.weekPattern.length)
      ctx.addIssue({
        code: "custom",
        path: ["weekPattern"],
        message: "En az bir gün seçin",
      });
  });
export type BulkAssignmentFormValues = z.infer<typeof bulkAssignmentFormSchema>;
