import { describe, expect, it } from "vitest";
import { emailSchema, fieldMessages, loginSchema, registrationSchema } from "./authFormSchemas";

describe("Türkçe form doğrulaması", () => {
  it("giriş mevcut kısa şifreye yeni kayıt şartı uygulamaz", () => expect(loginSchema.safeParse({ email: "user@example.com", password: "old" }).success).toBe(true));
  it("kayıt boş alan ve kısa şifreyi alan adıyla bildirir", () => {
    const result = registrationSchema.safeParse({ firstName: " ", lastName: "", companyName: "", email: "bad", password: "old" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldMessages(result.error)).toEqual({ firstName: "Adınızı girin.", lastName: "Soyadınızı girin.", companyName: "Firma adını girin.", email: "Geçerli bir e-posta adresi girin.", password: "Şifre en az 8 karakter olmalıdır." });
  });
  it("resend e-posta doğrulaması trim yapar", () => expect(emailSchema.parse(" user@example.com ")).toBe("user@example.com"));
});
