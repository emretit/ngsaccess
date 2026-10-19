import { describe, expect, it } from "vitest";
import { deviceBrandLabel } from "./deviceBrand";

describe("deviceBrandLabel", () => {
  it.each([
    ["hikvision", "Hikvision"],
    ["ide_smart", "IDE Smart"],
    ["other", "Diğer"],
    ["unknown-brand", "Diğer"],
    ["", "Diğer"],
    [null, "Diğer"],
    [undefined, "Diğer"],
  ])("labels %s as %s", (brand, label) => {
    expect(deviceBrandLabel(brand)).toBe(label);
  });
});
