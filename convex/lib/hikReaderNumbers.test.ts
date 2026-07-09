import { describe, expect, it } from "vitest";
import { deriveHikReaderNoFromDoorNo } from "./hikReaderNumbers";

describe("hikReaderNumbers - deriveHikReaderNoFromDoorNo", () => {
  it("kapı numarası ve yöne göre fiziksel okuyucu numarasını üretir", () => {
    expect(deriveHikReaderNoFromDoorNo(1, "entry")).toBe(1);
    expect(deriveHikReaderNoFromDoorNo(1, "exit")).toBe(2);
    expect(deriveHikReaderNoFromDoorNo(1, "both")).toBe(1);
    expect(deriveHikReaderNoFromDoorNo(2, "entry")).toBe(3);
    expect(deriveHikReaderNoFromDoorNo(2, "exit")).toBe(4);
  });

  it("kapı numarası yoksa undefined döner", () => {
    expect(deriveHikReaderNoFromDoorNo(undefined, "entry")).toBeUndefined();
  });
});
