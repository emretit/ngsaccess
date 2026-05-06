import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayEnum = z.enum([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export const accessRuleSchema = z
  .object({
    name: z.string().min(1, "Lütfen kural adı girin."),
    description: z.string().optional(),
    targetType: z.enum(["all", "department", "position", "individual"]),
    selectedEmployees: z.array(z.string()),
    selectedDevices: z.array(z.string()),
    selectedZones: z.array(z.string()),
    selectedDoors: z.array(z.string()),
    startTime: z
      .string()
      .refine((v) => v === "" || HHMM.test(v), {
        message: "Başlangıç saati HH:MM formatında olmalı",
      }),
    endTime: z
      .string()
      .refine((v) => v === "" || HHMM.test(v), {
        message: "Bitiş saati HH:MM formatında olmalı",
      }),
    days: z.array(dayEnum).min(1, "En az bir gün seçin"),
    accessDirection: z.enum(["entry", "exit", "both"]),
    priority: z.number().int().min(0),
  })
  .superRefine((data, ctx) => {
    if (data.targetType === "individual" && data.selectedEmployees.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lütfen en az bir çalışan seçin.",
        path: ["selectedEmployees"],
      });
    }
    if (
      data.selectedDevices.length === 0 &&
      data.selectedZones.length === 0 &&
      data.selectedDoors.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lütfen en az bir cihaz, bölge veya kapı seçin.",
        path: ["selectedDevices"],
      });
    }
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitiş saati başlangıçtan sonra olmalı.",
        path: ["endTime"],
      });
    }
  });

export type AccessRuleFormInput = z.infer<typeof accessRuleSchema>;
