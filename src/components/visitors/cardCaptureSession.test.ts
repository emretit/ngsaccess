import { describe, expect, it } from "vitest";
import { createCardCaptureSession } from "./cardCaptureSession";
import { visitorFormSchema } from "./hooks/useVisitorFormSchema";

describe("tek seferlik ziyaretçi kart yakalama", () => {
  it("A yakalandıktan sonra B ve tekrarlanan effect A'yı değiştirmez", () => {
    const session = createCardCaptureSession();
    expect(session.capture(undefined)).toBeNull();
    expect(session.capture("A")).toBe("A");
    expect(session.capture("B")).toBeNull();
    expect(session.capture("A")).toBeNull();
    session.rearm();
    expect(session.capture("B")).toBe("B");
  });
});

describe("ziyaretçi form hataları", () => {
  const valid = { firstName: "Ada", lastName: "Soyad", cardNumber: "123", presetRuleId: "zone", accessExpiresAt: "2099-10-16T18:00", isActive: true };
  it("iade edilmiş pasif kaydı yeni kart vermeden düzenler, aktivasyonda kart ister", () => {
    expect(visitorFormSchema.safeParse({ ...valid, isEditing: true, isActive: false, cardNumber: "" }).success).toBe(true);
    expect(visitorFormSchema.safeParse({ ...valid, isEditing: true, isActive: true, cardNumber: "" }).success).toBe(false);
    expect(visitorFormSchema.safeParse({ ...valid, isActive: false, cardNumber: "" }).success).toBe(false);
  });
  it.each([
    [{ presetRuleId: null }, "presetRuleId"],
    [{ accessExpiresAt: "2020-01-01T12:00" }, "accessExpiresAt"],
    [{ firstName: " " }, "firstName"],
    [{ cardNumber: "IADE:123:visitor" }, "cardNumber"],
    [{ cardNumber: "" }, "cardNumber"],
  ] as const)("alan hatasını ilgili alana bağlar: %j", (patch, field) => {
    const result = visitorFormSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });
});
