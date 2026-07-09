import { describe, expect, it } from "vitest";
import { summarizeCardReaderSnapshot } from "./readers";

describe("gateway/readers - summarizeCardReaderSnapshot", () => {
  it("CardReaderCfg, CardReaderPlan ve anti-sneak alanlarini ozetler", () => {
    const summary = summarizeCardReaderSnapshot(
      3,
      {
        CardReaderCfg: {
          enable: true,
          cardReaderName: "Giris Okuyucu",
          cardReaderFunction: ["fingerPrint", "face", "card"],
          cardReaderDescription: "RS-485",
          swipeInterval: 2,
          pressTimeout: 5,
          enableTamperCheck: true,
        },
      },
      { CardReaderPlan: { templateNo: 12 } },
      { CardReaderAntiSneakCfg: { enable: true, followUpCardReader: [4] } },
    );

    expect(summary).toEqual({
      readerNo: 3,
      cardReaderName: "Giris Okuyucu",
      enabled: true,
      functions: ["fingerPrint", "face", "card"],
      description: "RS-485",
      swipeInterval: 2,
      pressTimeout: 5,
      tamperCheckEnabled: true,
      templateNo: 12,
      antiSneakEnabled: true,
      followUpCardReaders: [4],
    });
  });

  it("eksik veya beklenmeyen alanlarda yalniz readerNo dondurur", () => {
    expect(
      summarizeCardReaderSnapshot(1, { CardReaderCfg: null }, "bad", {
        CardReaderAntiSneakCfg: { followUpCardReader: ["x"] },
      }),
    ).toEqual({ readerNo: 1 });
  });
});
