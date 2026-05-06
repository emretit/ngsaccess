import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const shiftFormSchema = z
  .object({
    name: z.string().trim().min(1, "Vardiya adı gereklidir").max(100),
    startTime: z.string().regex(TIME_REGEX, "HH:MM formatında olmalı"),
    endTime: z.string().regex(TIME_REGEX, "HH:MM formatında olmalı"),
    breakStart: z
      .string()
      .regex(TIME_REGEX, "HH:MM formatında olmalı")
      .optional()
      .or(z.literal("")),
    breakEnd: z
      .string()
      .regex(TIME_REGEX, "HH:MM formatında olmalı")
      .optional()
      .or(z.literal("")),
    isActive: z.boolean(),
  })
  .refine(
    (d) => (d.breakStart ? !!d.breakEnd : !d.breakEnd),
    {
      message: "Mola başlangıç ve bitiş birlikte verilmeli",
      path: ["breakEnd"],
    }
  )
  .refine((d) => d.startTime !== d.endTime, {
    message: "Başlangıç ve bitiş aynı olamaz",
    path: ["endTime"],
  });

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;
