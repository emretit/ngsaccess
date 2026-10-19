import { describe, expect, it } from "vitest";
import { normalizeAuthEmail } from "./authEmail";

describe("normalizeAuthEmail", () => {
  it("trimler ve küçük harfe çevirir", () => {
    expect(normalizeAuthEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });

  it.each(["", "   ", null, 42, {}])("geçersiz e-postayı reddeder: %s", (email) => {
    expect(() => normalizeAuthEmail(email)).toThrow("Geçerli bir e-posta girin");
  });
});
