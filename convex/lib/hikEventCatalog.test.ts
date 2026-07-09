import { describe, expect, it } from "vitest";
import {
  classifyHikEvent,
  HIK_MAJOR_EVENT_TYPES,
  shouldCreateCardReadingForHikEvent,
} from "./hikEventCatalog";

const { DEVICE_ALARM, DEVICE_EVENT, DEVICE_EXCEPTION, DEVICE_OPERATION } =
  HIK_MAJOR_EVENT_TYPES;

describe("hikEventCatalog - classifyHikEvent", () => {
  it("access grant kodlarini cardReadings'e yonlendirir", () => {
    const event = classifyHikEvent(DEVICE_EVENT, 1);

    expect(event.category).toBe("access");
    expect(event.accessDecision).toBe("izin_verildi");
    expect(event.shouldCreateCardReading).toBe(true);
  });

  it("access deny kodlarini ret nedeniyle cardReadings'e yonlendirir", () => {
    const event = classifyHikEvent(DEVICE_EVENT, 6);

    expect(event.category).toBe("access");
    expect(event.accessDecision).toBe("reddedildi");
    expect(event.denialReason).toBe("Yetki yok");
    expect(event.shouldCreateCardReading).toBe(true);
  });

  it("alarm, exception ve operation olaylarini PDKS disinda tutar", () => {
    expect(classifyHikEvent(DEVICE_ALARM, 1030).category).toBe("alarm");
    expect(classifyHikEvent(DEVICE_ALARM, 1030).shouldCreateCardReading).toBe(false);

    expect(classifyHikEvent(DEVICE_EXCEPTION, 1).category).toBe("exception");
    expect(classifyHikEvent(DEVICE_EXCEPTION, 1).shouldCreateCardReading).toBe(false);

    expect(classifyHikEvent(DEVICE_OPERATION, 80).category).toBe("operation");
    expect(classifyHikEvent(DEVICE_OPERATION, 80).shouldCreateCardReading).toBe(false);
  });

  it("bilinmeyen DEVICE_EVENT kodunu status olarak siniflandirir", () => {
    const event = classifyHikEvent(DEVICE_EVENT, 9999);

    expect(event.category).toBe("status");
    expect(event.shouldCreateCardReading).toBe(false);
  });
});

describe("hikEventCatalog - shouldCreateCardReadingForHikEvent", () => {
  it("kart numarasi olan bilinmeyen DEVICE_EVENT kodlarini legacy PDKS akisi icin korur", () => {
    expect(shouldCreateCardReadingForHikEvent(DEVICE_EVENT, 9999, true)).toBe(true);
  });

  it("kart numarasi olmayan status event'leri deviceEvents'e birakir", () => {
    expect(shouldCreateCardReadingForHikEvent(DEVICE_EVENT, 9999, false)).toBe(false);
  });

  it("major/minor olmayan eski kart okuyucu postlarini islemeye devam eder", () => {
    expect(shouldCreateCardReadingForHikEvent(undefined, undefined, true)).toBe(true);
  });
});
