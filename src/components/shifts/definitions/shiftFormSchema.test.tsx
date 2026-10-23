import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FLEXIBLE } from "../../../../convex/lib/pdksFlexible";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AddShiftDialog, type EditingShift } from "./AddShiftDialog";
import { shiftFormSchema, shiftPayloadSchema, type ShiftFormPayload, type ShiftFormValues } from "./shiftFormSchema";

vi.mock("convex/react", () => ({ useQuery: () => ({ asOfDate: "2026-10-22", assignmentCount: 0, employeeCount: 0, countLabel: "Toplam", truncated: false, skippedAssignments: 0 }) }));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box };
});
const fixed: ShiftFormValues = { name: "Sabit", startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00", overtimeEnabled: true, isActive: true };
function render(shift: EditingShift | null) {
  return renderToStaticMarkup(<AddShiftDialog open editingShift={shift} onOpenChange={() => undefined} onClose={() => undefined} onAdd={() => undefined} onUpdate={() => undefined} />);
}

describe("Sabit / Esnek vardiya formu", () => {
  it("sabit payload ve doğrulama davranışını korur", () => {
    expect(shiftPayloadSchema.parse(fixed)).toMatchObject({ startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00" });
    expect(shiftFormSchema.safeParse({ ...fixed, endTime: "08:00" }).success).toBe(false);
    expect(render(null)).toContain("Sabit");
  });
  it("esnek geçişinde gizlenen sabit saatleri kullanmaz; tipli payload pencereleri taşır", () => {
    const payload: ShiftFormPayload = shiftPayloadSchema.parse({ ...fixed, startTime: "", endTime: "", scheduleType: "flexible", flexible: DEFAULT_FLEXIBLE });
    expect(payload).toMatchObject({ scheduleType: "flexible", startTime: "05:00", endTime: "22:00", breakStart: null, breakEnd: null, flexible: DEFAULT_FLEXIBLE });
    const html = render({ ...payload, color: undefined, _id: "shift" as Id<"shifts">, breakStart: undefined, breakEnd: undefined, lateToleranceMinutes: undefined, earlyExitToleranceMinutes: undefined, overtimeStartToleranceMinutes: undefined });
    expect(html).toContain("Günlük net hedef (dk)");
    expect(html).toContain("En geç çıkış günü");
    // Hesap alanı değişmeden açılan esnek tanım yerinde güncellenir (ad/renk/aktiflik).
    expect(html).toContain("Ad, renk ve aktiflik bu tanımda güncellenir.");
    expect(html).not.toContain("Yeni tanım olarak kaydet");
    expect(html).toContain("Saat veya hesap değişikliği yeni tanım olarak kaydedilir.");
    expect(html).not.toContain("Başlangıç saati");
    expect(html).not.toContain("Geç kalma toleransı");
    expect(html).not.toContain("Mola başlangıcı");
  });
  it("sabit moda dönüş, sabit saat ve mola doğrulamasını geri getirir", () => {
    const switched = { ...fixed, scheduleType: "fixed" as const, flexible: { ...DEFAULT_FLEXIBLE, requiredNetMinutes: 0 } };
    expect(shiftPayloadSchema.parse(switched).flexible).toBeUndefined();
    expect(shiftFormSchema.safeParse({ ...switched, breakEnd: "" }).success).toBe(false);
  });
  it.each([
    [{ checkInStart: "22:00", checkInEnd: "05:00" }, "aynı gün"],
    [{ requiredNetMinutes: 0 }, "pozitif tam sayı"],
    [{ maxSpanMinutes: 1500 }, "1–1440"],
    [{ breakMinutes: undefined }, "Mola süresi gereklidir"],
    [{ checkInEnd: "24:00" }, "HH:MM"],
    [{ checkOutEndDayOffset: 0 }, "Her izinli girişten"],
  ])("Türkçe hata verir: %j", (patch, text) => {
    const result = shiftFormSchema.safeParse({ ...fixed, scheduleType: "flexible", flexible: { ...DEFAULT_FLEXIBLE, ...patch } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes(text))).toBe(true);
  });
});

it("accepts allowed colors, rejects unknown ones and encodes no color as null", () => {
  expect(shiftPayloadSchema.parse({ ...fixed, color: "blue" }).color).toBe("blue");
  expect(shiftPayloadSchema.parse(fixed).color).toBeNull();
  expect(shiftPayloadSchema.safeParse({ ...fixed, color: "red" }).success).toBe(false);
});

it("advanced rules hydrate in a closed section and blank fields clear through null", () => {
  const rules = { validWindow: { checkInStart: "07:00", checkInEnd: "09:00", checkOutStart: "16:00", checkOutEnd: "18:00", checkOutEndDayOffset: 0 as const }, absentAfterLateMinutes: 30, minWorkMinutes: 360, missingCheckInLateMinutes: 15, holidayWorkRequired: true };
  expect(shiftPayloadSchema.parse({ ...fixed, ...rules })).toMatchObject(rules);
  expect(shiftPayloadSchema.parse(fixed)).toMatchObject({ validWindow: null, absentAfterLateMinutes: null, minWorkMinutes: null, missingCheckInLateMinutes: null, holidayWorkRequired: null });
  const html = render({ ...fixed, ...rules, _id: "shift" as Id<"shifts"> });
  expect(html).toContain("Gelişmiş");
  expect(html).not.toContain("<details open");
  expect(html).toContain('value="360"');
  expect(html).toContain('value="07:00"');
  const flexible = { ...fixed, ...rules, scheduleType: "flexible" as const, flexible: DEFAULT_FLEXIBLE };
  const payload = shiftPayloadSchema.parse(flexible);
  expect(payload.validWindow).toBeUndefined();
  expect(payload.minWorkMinutes).toBeUndefined();
  expect(render({ ...flexible, _id: "shift" as Id<"shifts"> })).not.toContain("Gelişmiş");
});

it("advanced rules validate limits, windows and zero without coercing blanks to zero", () => {
  expect(shiftPayloadSchema.parse({ ...fixed, minWorkMinutes: 0 }).minWorkMinutes).toBe(0);
  expect(shiftPayloadSchema.parse({ ...fixed, minWorkMinutes: 1440 }).minWorkMinutes).toBe(1440);
  expect(shiftPayloadSchema.safeParse({ ...fixed, minWorkMinutes: 1441 }).success).toBe(false);
  expect(shiftPayloadSchema.safeParse({ ...fixed, validWindow: { checkInStart: "09:00", checkInEnd: "10:00", checkOutStart: "16:00", checkOutEnd: "18:00", checkOutEndDayOffset: 0 } }).success).toBe(false);
});
