import { describe, expect, it } from "vitest";
import { pdfThemeColor } from "./useExportUtils";

describe("pdfThemeColor", () => {
  it("converts neutral theme surfaces and text", () => {
    expect(pdfThemeColor("0 0% 100%")).toEqual([255, 255, 255]);
    expect(pdfThemeColor("0 0% 0%")).toEqual([0, 0, 0]);
    expect(pdfThemeColor("  60 2.7778% 14.1176%  ")).toEqual([37, 37, 35]);
  });

  it("converts the A2 primary and status hues", () => {
    expect(pdfThemeColor("0 59.4771% 30%")).toEqual([122, 31, 31]);
    expect(pdfThemeColor("120 100% 50%")).toEqual([0, 255, 0]);
    expect(pdfThemeColor("240 100% 50%")).toEqual([0, 0, 255]);
  });
});
