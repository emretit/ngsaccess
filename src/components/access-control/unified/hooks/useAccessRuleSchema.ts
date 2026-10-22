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
    scheduleMode: z.enum(["custom", "template"]).default("custom"),
    scheduleTemplateId: z.string().optional(),
    name: z.string().trim().min(1, "Lütfen kural adı girin."),
    description: z.string().optional(),
    targetType: z.enum([
      "all",
      "department",
      "position",
      "individual",
      "visitor",
    ]),
    selectedEmployees: z.array(z.string()),
    selectedDevices: z.array(z.string()),
    selectedZones: z.array(z.string()),
    selectedDoors: z.array(z.string()),
    startTime: z.string(),
    endTime: z.string(),
    days: z.array(dayEnum),
    accessDirection: z.enum(["entry", "exit", "both"]),
    priority: z.number().int().min(0),
  })
  .superRefine((data, ctx) => {
    if (
      data.targetType === "individual" &&
      data.selectedEmployees.length === 0
    ) {
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
    if (data.scheduleMode === "template") {
      if (!data.scheduleTemplateId)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bir zaman şablonu seçin",
          path: ["scheduleTemplateId"],
        });
      return;
    }
    for (const field of ["startTime", "endTime"] as const) {
      if (data[field] && !HHMM.test(data[field]))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field === "startTime" ? "Başlangıç" : "Bitiş"} saati HH:MM formatında olmalı`,
          path: [field],
        });
    }
    if (!data.days.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "En az bir gün seçin",
        path: ["days"],
      });
    if (Boolean(data.startTime) !== Boolean(data.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Başlangıç ve bitiş saatini birlikte girin veya tüm günü seçin.",
        path: [data.startTime ? "endTime" : "startTime"],
      });
    }
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Bitiş saati başlangıçtan sonra olmalı; geceyi aşan plan için ayrı kurallar oluşturun.",
        path: ["endTime"],
      });
    }
  });

export type AccessRuleFormInput = z.infer<typeof accessRuleSchema>;
