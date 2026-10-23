import { validDay } from "../../../convex/lib/shiftUx";
import type { Id } from "../../../convex/_generated/dataModel";
import { MAX_DAY_CYCLE, MAX_SHIFTS_PER_DAY, MAX_WEEK_CYCLE, validatePlanStructure } from "../../../convex/lib/shiftPlan";
import { shiftError } from "./lib/shiftError";
import { z } from "zod";

const shiftIdSchema = z.string().min(1).transform(value => value as Id<"shifts">);
const slotSchema = z.array(shiftIdSchema).max(MAX_SHIFTS_PER_DAY, "Bir güne en fazla 8 vardiya konabilir");
export const planFormSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("weekly"), shiftIds: slotSchema.min(1) }),
  z.object({ kind: z.literal("dayCycle"), anchorDate: z.string(), slots: z.array(slotSchema).max(MAX_DAY_CYCLE) }),
  z.object({ kind: z.literal("weekCycle"), anchorDate: z.string(), slots: z.array(slotSchema).max(MAX_WEEK_CYCLE * 7) }),
]);
export const bulkAssignmentFormSchema = z
  .object({
    target: z.enum(["people", "department"]).optional(),
    departmentId: z.string().optional(),
    plan: planFormSchema.optional(),
    employeeIds: z
      .array(z.string().min(1, "Çalışan seçin"))
      .max(100, "En fazla 100 çalışan seçin"),
    shiftId: z.string(),
    startDate: z.string().refine(validDay, "Başlangıç tarihi seçin"),
    endDate: z.string().refine(validDay, "Bitiş tarihi seçin"),
    specificDays: z.boolean(),
    weekPattern: z.array(
      z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
    ),
  })
  .superRefine((value, ctx) => {
    if (!value.plan && !value.shiftId)
      ctx.addIssue({ code: "custom", path: ["shiftId"], message: "Vardiya seçin" });
    if (value.target === "department" ? !value.departmentId : !value.employeeIds.length)
      ctx.addIssue({ code: "custom", path: [value.target === "department" ? "departmentId" : "employeeIds"], message: value.target === "department" ? "Departman seçin" : "En az bir çalışan seçin" });
    if (value.plan) {
      try { validatePlanStructure(value.plan, value.specificDays ? value.weekPattern : undefined); }
      catch (error) { ctx.addIssue({ code: "custom", path: ["plan"], message: shiftError(error).message }); }
    }
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
