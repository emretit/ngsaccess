import { describe, it, expect } from "vitest";
import { defaultDoorName, readerDirectionFromIo } from "./deviceHelpers";

describe("deviceHelpers – defaultDoorName", () => {
  it("0-indeksli io → 1-indeksli ad", () => {
    expect(defaultDoorName(0)).toBe("Kapı 1");
    expect(defaultDoorName(3)).toBe("Kapı 4");
  });
});

describe("deviceHelpers – readerDirectionFromIo", () => {
  it("io 0 → entry, 1 → exit, diğer → both", () => {
    expect(readerDirectionFromIo(0)).toBe("entry");
    expect(readerDirectionFromIo(1)).toBe("exit");
    expect(readerDirectionFromIo(2)).toBe("both");
    expect(readerDirectionFromIo(5)).toBe("both");
  });
});
