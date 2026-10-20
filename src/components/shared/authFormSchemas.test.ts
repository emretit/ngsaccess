import { describe, expect, it } from "vitest";
import { emailSchema, fieldMessages, loginSchema, registrationSchema } from "./authFormSchemas";

describe("Türkçe form doğrulaması", () => {
  it("giriş mevcut kısa şifreye yeni kayıt şartı uygulamaz", () => expect(loginSchema.safeParse({ email: "user@example.com", password: "old" }).success).toBe(true));
  it("kayıt boş alan ve kısa şifreyi alan adıyla bildirir", () => {
    const result = registrationSchema.safeParse({ firstName: " ", lastName: "", companyName: "", email: "bad", password: "old" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldMessages(result.error)).toEqual({ firstName: "Adınızı girin.", lastName: "Soyadınızı girin.", companyName: "Firma adını girin.", email: "Geçerli bir e-posta adresi girin.", password: "Şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir." });
  });
  it.each(["abcdefgh1", "ABCDEFGH1", "Abcdefgh", "Aa12345"])("kayıt eksik şifre gereksinimini reddeder: %s", (password) => {
    expect(registrationSchema.safeParse({ firstName: "Ada", lastName: "Test", companyName: "Firma", email: "user@example.com", password }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "user@example.com", password }).success).toBe(true);
  });
  it("kayıt güçlü şifreyi değiştirmeden kabul eder", () => {
    const password = " Aa123456 ";
    expect(registrationSchema.parse({ firstName: "Ada", lastName: "Test", companyName: "Firma", email: "user@example.com", password }).password).toBe(password);
  });
  it("resend e-posta doğrulaması trim yapar", () => expect(emailSchema.parse(" user@example.com ")).toBe("user@example.com"));
});
