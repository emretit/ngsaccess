import { describe, expect, it } from "vitest";
import { resolveCardReaderAuth, withDeviceToken, type CardReaderAuthInput } from "./cardReaderAuth";

const base: CardReaderAuthInput = {
  authorizationHeader: null,
  queryToken: null,
  relayHeader: null,
  queryRelay: null,
  relaySecret: undefined,
  allowUnauthenticated: undefined,
};

describe("resolveCardReaderAuth", () => {
  it("kimlik bilgisi yoksa reddeder (varsayılan kapalı)", () => {
    expect(resolveCardReaderAuth(base)).toEqual({ kind: "reject", reason: "missing_credentials" });
  });

  it("Bearer token'ı kabul eder", () => {
    expect(resolveCardReaderAuth({ ...base, authorizationHeader: "Bearer abc" })).toEqual({
      kind: "token",
      token: "abc",
    });
  });

  it("?token= query'sini kabul eder (httpHosts header gönderemez)", () => {
    expect(resolveCardReaderAuth({ ...base, queryToken: "xyz" })).toEqual({
      kind: "token",
      token: "xyz",
    });
  });

  it("Bearer, query token'dan önceliklidir", () => {
    expect(
      resolveCardReaderAuth({ ...base, authorizationHeader: "Bearer h", queryToken: "q" }),
    ).toEqual({ kind: "token", token: "h" });
  });

  it("boş Bearer token yok sayılır", () => {
    expect(resolveCardReaderAuth({ ...base, authorizationHeader: "Bearer   " }).kind).toBe("reject");
  });

  it("token verildiyse legacy bayrağı açık olsa bile karar token'a aittir", () => {
    expect(
      resolveCardReaderAuth({ ...base, queryToken: "bad", allowUnauthenticated: "1" }).kind,
    ).toBe("token");
  });

  it("doğru relay secret'ı (header veya query) relay olarak kabul eder", () => {
    const withSecret = { ...base, relaySecret: "s3cret" };
    expect(resolveCardReaderAuth({ ...withSecret, relayHeader: "s3cret" }).kind).toBe("relay");
    expect(resolveCardReaderAuth({ ...withSecret, queryRelay: "s3cret" }).kind).toBe("relay");
  });

  it("yanlış relay secret'ı reddeder", () => {
    expect(
      resolveCardReaderAuth({ ...base, relaySecret: "s3cret", relayHeader: "wrong" }).kind,
    ).toBe("reject");
  });

  it("env'de relay secret yoksa boş relay ile eşleşmez", () => {
    expect(resolveCardReaderAuth({ ...base, relaySecret: "", relayHeader: "" }).kind).toBe("reject");
  });

  it("legacy yalnız bayrak tam olarak '1' ise açılır", () => {
    expect(resolveCardReaderAuth({ ...base, allowUnauthenticated: "1" }).kind).toBe("legacy");
    expect(resolveCardReaderAuth({ ...base, allowUnauthenticated: "true" }).kind).toBe("reject");
  });
});

describe("withDeviceToken", () => {
  it("token'ı query olarak ekler, mevcut query'yi korur", () => {
    expect(withDeviceToken("https://x.convex.site/card-reader?a=1", "tok")).toBe(
      "https://x.convex.site/card-reader?a=1&token=tok",
    );
  });

  it("var olan token'ı değiştirir", () => {
    expect(withDeviceToken("https://x.convex.site/card-reader?token=old", "new")).toBe(
      "https://x.convex.site/card-reader?token=new",
    );
  });
});
