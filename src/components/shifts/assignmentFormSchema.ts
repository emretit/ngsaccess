import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

export const assignmentFormSchema = z
  .object({
    employeeId: z.string().min(1, "Çalışan seçin"),
    shiftId: z.string().min(1, "Vardiya seçin"),
    startDate: z.string().regex(ISO_DATE, "Başlangıç tarihi seçin"),
    endDate: z.string().regex(ISO_DATE, "Bitiş tarihi seçin"),
  })
  .refine((v) => v.startDate <= v.endDate, {
    path: ["endDate"],
    message: "Bitiş tarihi başlangıçtan önce olamaz",
  })
  .refine(
    (v) => {
      const start = new Date(v.startDate).getTime();
      const end = new Date(v.endDate).getTime();
      const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
      return days <= MAX_RANGE_DAYS;
    },
    { path: ["endDate"], message: "Aralık 365 günden fazla olamaz" },
  );

export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>;
