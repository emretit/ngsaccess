import { errorMessage } from "@/lib/notify";
import { validateShift } from "../../../../convex/lib/shiftUx";
import { validateShiftSchedule } from "../../../../convex/lib/shiftSchedule";
import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const flexibleTimeSchema = z.string().regex(TIME_REGEX, "HH:MM formatında olmalı");

export const flexibleFormSchema = z.object({
  requiredNetMinutes: z.number({ message: "Hedef süre dakika olmalıdır" }).int("Hedef süre pozitif tam sayı dakika olmalıdır").positive("Hedef süre pozitif tam sayı dakika olmalıdır"),
  checkInStart: flexibleTimeSchema, checkInEnd: flexibleTimeSchema, checkOutStart: flexibleTimeSchema, checkOutEnd: flexibleTimeSchema,
  checkOutEndDayOffset: z.union([z.literal(0), z.literal(1)]),
  maxSpanMinutes: z.number({ message: "Azami oturum dakika olmalıdır" }).int("Azami oturum 1–1440 arasında tam sayı dakika olmalıdır").min(1, "Azami oturum 1–1440 arasında tam sayı dakika olmalıdır").max(1440, "Azami oturum 1–1440 arasında tam sayı dakika olmalıdır"),
  breakMode: z.literal("duration"),
  breakMinutes: z.number({ message: "Mola süresi dakika olmalıdır" }).optional(),
});

const rawShiftFormSchema = z
  .object({
    scheduleMode: z.enum(["daily", "weekly", "cycle"]).optional(),
    dayPlan: z.array(z.boolean()).max(31).optional(),
    name: z.string().trim().min(1, "Vardiya adı gereklidir").max(100),
    scheduleType: z.enum(["fixed", "flexible"]).optional(),
    flexible: flexibleFormSchema.optional(),
    validWindow: z.object({
      checkInStart: z.string().regex(TIME_REGEX, "HH:MM formatında olmalı"),
      checkInEnd: z.string().regex(TIME_REGEX, "HH:MM formatında olmalı"),
      checkOutStart: z.string().regex(TIME_REGEX, "HH:MM formatında olmalı"),
      checkOutEnd: z.string().regex(TIME_REGEX, "HH:MM formatında olmalı"),
      checkOutEndDayOffset: z.union([z.literal(0), z.literal(1)]),
    }).optional(),
    absentAfterLateMinutes: z.number().int("Tam sayı dakika girin").min(0, "Negatif olamaz").max(1440, "En çok 1440 dakika").optional(),
    minWorkMinutes: z.number().int("Tam sayı dakika girin").min(0, "Negatif olamaz").max(1440, "En çok 1440 dakika").optional(),
    missingCheckInLateMinutes: z.number().int("Tam sayı dakika girin").min(0, "Negatif olamaz").max(1440, "En çok 1440 dakika").optional(),
    holidayWorkRequired: z.boolean().optional(),
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
    lateToleranceMinutes: z
      .number()
      .int()
      .min(0, "Negatif olamaz")
      .max(240, "En çok 240 dakika")
      .optional(),
    earlyExitToleranceMinutes: z
      .number()
      .int()
      .min(0, "Negatif olamaz")
      .max(240, "En çok 240 dakika")
      .optional(),
    overtimeStartToleranceMinutes: z
      .number()
      .int()
      .min(0, "Negatif olamaz")
      .max(240, "En çok 240 dakika")
      .optional(),
    overtimeEnabled: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // Validate combined rules after individual fields pass, so their errors stay attached to the right controls.
    if (ctx.issues.length > 0) return;
    try { validateShiftSchedule(data); }
    catch (error: unknown) { ctx.addIssue({ code: "custom", message: errorMessage(error), path: ["dayPlan"] }); }
    try {
      validateShift({
        ...data,
        breakStart: data.breakStart || undefined,
        breakEnd: data.breakEnd || undefined,
      });
    } catch (error: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: errorMessage(error),
        path: [data.scheduleType === "flexible" ? "flexible" : data.validWindow ? "validWindow" : "breakEnd"],
      });
    }
  })
  .refine((d) => d.scheduleType === "flexible" || (d.breakStart ? !!d.breakEnd : !d.breakEnd), {
    message: "Mola başlangıç ve bitiş birlikte verilmeli",
    path: ["breakEnd"],
  })
  .refine((d) => d.scheduleType === "flexible" || d.startTime !== d.endTime, {
    message: "Başlangıç ve bitiş aynı olamaz",
    path: ["endTime"],
  });

export const shiftFormSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null && "scheduleType" in input && input.scheduleType === "flexible") {
    // Hidden fixed fields never block a switch to a flexible definition.
    return { ...input, validWindow: undefined, absentAfterLateMinutes: undefined, missingCheckInLateMinutes: undefined, startTime: "00:00", endTime: "00:00", breakStart: "", breakEnd: "", lateToleranceMinutes: undefined, earlyExitToleranceMinutes: undefined };
  }
  if (typeof input === "object" && input !== null) return { ...input, flexible: undefined };
  return input;
}, rawShiftFormSchema);
export type ShiftFormValues = z.infer<typeof shiftFormSchema>;

export const shiftPayloadSchema = shiftFormSchema.transform(data => ({
  ...data,
  ...(data.scheduleType === "flexible" ? {
    minWorkMinutes: data.minWorkMinutes ?? null,
    holidayWorkRequired: data.holidayWorkRequired ?? null,
  } : {
    validWindow: data.validWindow ?? null,
    absentAfterLateMinutes: data.absentAfterLateMinutes ?? null,
    minWorkMinutes: data.minWorkMinutes ?? null,
    missingCheckInLateMinutes: data.missingCheckInLateMinutes ?? null,
    holidayWorkRequired: data.holidayWorkRequired ?? null,
  }),
  ...(data.scheduleType === "flexible" && data.flexible ? {
    startTime: data.flexible.checkInStart, endTime: data.flexible.checkInEnd,
  } : { flexible: undefined }),
  breakStart: data.scheduleType === "flexible" ? null : data.breakStart || null,
  breakEnd: data.scheduleType === "flexible" ? null : data.breakEnd || null,
  lateToleranceMinutes: data.lateToleranceMinutes ?? null,
  earlyExitToleranceMinutes: data.earlyExitToleranceMinutes ?? null,
  overtimeStartToleranceMinutes: data.overtimeStartToleranceMinutes ?? null,
}));
export type ShiftFormPayload = z.infer<typeof shiftPayloadSchema>;
