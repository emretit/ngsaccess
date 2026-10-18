import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { shiftError } from "./shiftError";

describe("shift error compatibility", () => {
  it("uses structured conflict codes even without a legacy prefix", () => {
    expect(shiftError(new ConvexError({ code: "SHIFT_OVERLAP", message: "Vardiyalar çakışıyor" })))
      .toEqual({ code: "SHIFT_OVERLAP", message: "Vardiyalar çakışıyor" });
    expect(shiftError(new ConvexError({ code: "SHIFT_CALENDAR_CONFLICT", message: "İzin günü" })).code)
      .toBe("SHIFT_CALENDAR_CONFLICT");
  });
  it("accepts old backend errors and does not classify unrelated failures", () => {
    expect(shiftError(new Error("OVERLAP:1 Gece")).code).toBe("SHIFT_OVERLAP");
    expect(shiftError(new ConvexError("CALENDAR: İzin günü")).code).toBe("SHIFT_CALENDAR_CONFLICT");
    expect(shiftError(new Error("Bağlantı kesildi")).code).toBeUndefined();
  });
});
