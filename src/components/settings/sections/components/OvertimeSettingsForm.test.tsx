import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OvertimeSettingsForm, overtimeSettingsSchema } from "./OvertimeSettingsForm";
const state = vi.hoisted(() => ({ query: vi.fn(), save: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => state.query(...args), useMutation: () => state.save }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", loading: false, isAdmin: true }) }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: () => ({ run: vi.fn(), pending: false }) }));
// Expose portal content in the server renderer so all option text can be asserted.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, disabled }: { children: ReactNode; value: string; disabled?: boolean }) => <div data-select-value={value} data-disabled={disabled}>{children}</div>,
  SelectTrigger: ({ children, id }: { children: ReactNode; id: string }) => <button id={id} role="combobox">{children}</button>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div role="listbox">{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div role="option" data-value={value}>{children}</div>,
}));
const work = { annualOvertimeLimitHours: 270, overtimeStartToleranceMinutes: 15, monthlyHoursBase: 225 };
const rates = { weekdayMultiplier: 1.5, weekendMultiplier: 2, holidayMultiplier: 2, nightShiftMultiplier: 1.5, nightShiftStart: "22:00", nightShiftEnd: "06:00" };
beforeEach(() => state.query.mockReset());
describe("13-H1 night overtime rate policy", () => {
  it.each([undefined, "max", "multiply", "additive"] as const)("renders persisted %s with three choices, default=max and numeric example", mode => {
    state.query.mockReturnValueOnce(work).mockReturnValueOnce({ ...rates, nightCombineMode: mode });
    const html = renderToStaticMarkup(<OvertimeSettingsForm />);
    expect(html).toContain('Gece fazla mesaisinde çarpan');
    expect(html).toContain(`data-select-value="${mode ?? "max"}"`);
    expect(html).toContain('role="combobox"');
    expect(html.match(/role="option"/g)).toHaveLength(7);
    for (const label of ["Büyük olan", "Çarpım", "Ek prim", "büyük olan 2; çarpım 3; ek prim 2,5", "Normal gece çalışmasına ek prim verilmez."]) expect(html).toContain(label);
  });
  it("rejects identical night window endpoints and accepts overnight endpoints", () => {
    const valid = { ...work, ...rates, nightCombineMode: "max", overtimeBasis: "weekly45", nightShiftDayMode: "shiftStart" };
    expect(overtimeSettingsSchema.safeParse(valid).success).toBe(true);
    const invalid = overtimeSettingsSchema.safeParse({ ...valid, nightShiftEnd: "22:00" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0]).toMatchObject({ path: ["nightShiftEnd"], message: "Gece başlangıcı ve bitişi farklı olmalı." });
  });
});

 it.each([
   [undefined, undefined, "weekly45", "shiftStart"],
   ["dailyShift", "splitAtMidnight", "dailyShift", "splitAtMidnight"],
 ] as const)("renders project policies %s / %s with defaults and examples", (basis, mode, expectedBasis, expectedMode) => {
   state.query.mockReturnValueOnce(work).mockReturnValueOnce({ ...rates, overtimeBasis: basis, nightShiftDayMode: mode });
   const html = renderToStaticMarkup(<OvertimeSettingsForm />);
   for (const text of ["Fazla mesai esası", "Haftalık 45 saat (İş Kanunu)", "Günlük vardiya aşımı", "Gece yarısını geçen vardiya", "Başladığı günün ücreti", "Gece yarısında böl", "aşıldığı güne (cuma)", "00.00 sonrası"]) expect(html).toContain(text);
   expect(html).toContain(`data-select-value="${expectedBasis}"`);
   expect(html).toContain(`data-select-value="${expectedMode}"`);
 });
 it("accepts both policies and rejects unknown enum values", () => {
   const payload = { ...work, ...rates, nightCombineMode: "max", overtimeBasis: "dailyShift", nightShiftDayMode: "splitAtMidnight" };
   expect(overtimeSettingsSchema.parse(payload)).toMatchObject({ overtimeBasis: "dailyShift", nightShiftDayMode: "splitAtMidnight" });
   expect(overtimeSettingsSchema.safeParse({ ...payload, overtimeBasis: "monthly" }).success).toBe(false);
   expect(overtimeSettingsSchema.safeParse({ ...payload, nightShiftDayMode: "calendar" }).success).toBe(false);
 });

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "hr", loading: false }) }));
