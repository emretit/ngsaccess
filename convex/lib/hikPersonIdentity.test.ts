import { describe, expect, it } from "vitest";
import { hikPersonIdentity } from "./hikPersonIdentity";

describe("Hik person identity", () => {
  it.each([{}, { cardNumber: "" }, { hikEmployeeNo: "  ", cardNumber: " \t " }])("has no device identity for %j", employee => {
    expect(hikPersonIdentity(employee)).toBeUndefined();
    expect(hikPersonIdentity(employee)).not.toBe("");
  });
  it("keeps an imported device identity without a physical card", () => {
    expect(hikPersonIdentity({ hikEmployeeNo: " imported " })).toBe("imported");
    expect(hikPersonIdentity({ hikEmployeeNo: " imported ", cardNumber: "456" })).toBe("imported");
  });
  it("uses the physical card when the device identity is absent or blank", () => {
    expect(hikPersonIdentity({ cardNumber: " 123 " })).toBe("123");
    expect(hikPersonIdentity({ hikEmployeeNo: " ", cardNumber: " 123 " })).toBe("123");
  });
});
