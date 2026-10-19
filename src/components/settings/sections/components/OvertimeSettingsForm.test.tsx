import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OvertimeSettingsForm, overtimeSettingsSchema } from "./OvertimeSettingsForm";
const state = vi.hoisted(() => ({ query: vi.fn(), save: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => state.query(...args), useMutation: () => state.save }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", loading: false, isAdmin: true }) }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: () => ({ run: vi.fn(), pending: false }) }));
const work = { annualOvertimeLimitHours: 270, overtimeStartToleranceMinutes: 15, monthlyHoursBase: 225 };
const rates = { weekdayMultiplier: 1.5, weekendMultiplier: 2, holidayMultiplier: 2, nightShiftMultiplier: 1.5, nightShiftStart: "22:00", nightShiftEnd: "06:00" };
beforeEach(() => state.query.mockReset());
describe("13-H1 night overtime rate policy", () => {
  it.each([undefined, "max", "multiply", "additive"] as const)("renders persisted %s with three choices, default=max and numeric example", mode => {
    state.query.mockReturnValueOnce(work).mockReturnValueOnce({ ...rates, nightCombineMode: mode });
    const html = renderToStaticMarkup(<OvertimeSettingsForm />);
    expect(html).toContain('Gece fazla mesaisinde çarpan');
    expect(html).toContain(`<option value="${mode ?? "max"}" selected="">`);
    for (const label of ["Büyük olan", "Çarpım", "Ek prim", "büyük olan 2; çarpım 3; ek prim 2,5", "Normal gece çalışmasına ek prim verilmez."]) expect(html).toContain(label);
  });
  it("rejects identical night window endpoints and accepts overnight endpoints", () => {
    const valid = { ...work, ...rates, nightCombineMode: "max" };
    expect(overtimeSettingsSchema.safeParse(valid).success).toBe(true);
    const invalid = overtimeSettingsSchema.safeParse({ ...valid, nightShiftEnd: "22:00" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.error.issues[0]).toMatchObject({ path: ["nightShiftEnd"], message: "Gece başlangıcı ve bitişi farklı olmalı." });
  });
});
