import { describe, it, expect } from "vitest";
import {
  legalBreakMinutes,
  computeBreakDeduction,
  netWorkMinutes,
} from "./breakDeduction";

describe("breakDeduction – legalBreakMinutes", () => {
  it.each([
    [-1, 0],
    [0, 0],
    [1, 15],
    [239, 15],
    [240, 15],
    [241, 30],
    [449, 30],
    [450, 30],
    [451, 60],
    [540, 60],
  ])("%i dk çalışma → %i dk kanuni mola", (raw, expected) => {
    expect(legalBreakMinutes(raw)).toBe(expected);
  });
});

describe("breakDeduction – computeBreakDeduction", () => {
  const shift = { breakStart: "12:00", breakEnd: "13:00" };

  it("mola penceresi tam örtüşüyorsa fiili mola düşülür", () => {
    expect(
      computeBreakDeduction(450, shift, {
        entryMinutes: 9 * 60,
        exitMinutes: 16 * 60 + 30,
      }),
    ).toBe(60);
  });

  it("kısmi örtüşmede yalnız çalışmaya denk gelen mola düşülür", () => {
    expect(
      computeBreakDeduction(240, shift, {
        entryMinutes: 12 * 60 + 40,
        exitMinutes: 16 * 60 + 40,
      }),
    ).toBe(20);
  });

  it("mola penceresi örtüşmüyorsa kanuni kademe uygulanır", () => {
    expect(
      computeBreakDeduction(240, shift, {
        entryMinutes: 8 * 60,
        exitMinutes: 12 * 60,
      }),
    ).toBe(15);
  });

  it("giriş/çıkış verilmezse vardiyanın mola süresi kullanılır", () => {
    expect(computeBreakDeduction(450, shift)).toBe(60);
  });

  it("vardiya yoksa kanuni mola kullanılır", () => {
    expect(computeBreakDeduction(450)).toBe(30);
  });

  it("çalışma yoksa vardiya molası düşülmez", () => {
    expect(computeBreakDeduction(0, shift)).toBe(0);
  });
});

describe("breakDeduction – netWorkMinutes", () => {
  it("kanuni molayı ham süreden düşer", () => {
    expect(netWorkMinutes(240)).toBe(225);
    expect(netWorkMinutes(450)).toBe(420);
    expect(netWorkMinutes(540)).toBe(480);
  });

  it("vardiya molasının örtüşen kısmını düşer", () => {
    expect(
      netWorkMinutes(
        240,
        { breakStart: "12:00", breakEnd: "13:00" },
        { entryMinutes: 12 * 60 + 40, exitMinutes: 16 * 60 + 40 },
      ),
    ).toBe(220);
  });

  it("moladan kısa veya negatif çalışma süresini sıfıra kırpar", () => {
    expect(netWorkMinutes(1)).toBe(0);
    expect(netWorkMinutes(0)).toBe(0);
    expect(netWorkMinutes(-1)).toBe(0);
  });
});
