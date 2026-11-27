import { describe, expect, it } from "vitest";
import { cardNumberError } from "./cardNumberRules";

describe("shared card number rules", () => {
  it.each(["A B", "A!", "x".repeat(129), "1".repeat(21)])("rejects unsupported format %s", value => {
    expect(cardNumberError(value)).toBeTruthy();
  });
  it.each(["00123", " A-1_2 ", "x".repeat(128), "0".repeat(20)])("accepts application format %s", value => {
    expect(cardNumberError(value)).toBeUndefined();
  });
  it("only permits empty input when explicitly allowed", () => {
    expect(cardNumberError(" ")).toBeTruthy();
    expect(cardNumberError(" ", { allowEmpty: true })).toBeUndefined();
  });
  it.each(["0", "-1", "1e3", "0x10", "A-1", "9007199254740992"])("rejects unsafe IDE identity %s", value => {
    expect(cardNumberError(value, { deviceBrand: "ide_smart" })).toBeTruthy();
  });
  it("accepts IDE leading zeroes and safe maximum", () => {
    expect(cardNumberError("00123", { deviceBrand: "ide_smart" })).toBeUndefined();
    expect(cardNumberError("9007199254740991", { deviceBrand: "ide_smart" })).toBeUndefined();
  });
});
