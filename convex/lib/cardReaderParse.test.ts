import { describe, it, expect } from "vitest";
import {
  parseCardReaderBody,
  extractFromXmlOrMultipart,
  ideResultGranted,
  CARD_FIELDS,
  SERIAL_FIELDS,
} from "./cardReaderParse";

// ─── IDE Smart panel event'leri ──────────────────────────────────────────────

describe("parseCardReaderBody – IDE Smart", () => {
  it("GERÇEK access_event şeklinden user_id + actuator + result + uuid çıkarır", () => {
    // Canlı panelden yakalanan birebir şekil (2026-05-29, panel 289833329732592, WIEGAND2/W34):
    const body = JSON.stringify({
      payload: {
        result: 0,
        time: "2026-05-29 15:10:08",
        user_id: 4240722371,
        actuator: 2,
      },
      transaction: {
        token: null,
        type: "access_event",
        "msx-id": "mfiTps",
        "src-id": 289833329732592,
        "dst-id": 0,
      },
    });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("4240722371");
    expect(result.ideIoId).toBe(2);
    expect(result.ideResult).toBe(0);
    expect(result.ideTime).toBe("2026-05-29 15:10:08");
    // transaction.src-id panel UUID → ideUuid + serial fallback
    expect(result.ideUuid).toBe("289833329732592");
    expect(result.serial).toBe("289833329732592");
    // Hikvision alanları boş kalmalı
    expect(result.hikMajorEventType).toBeUndefined();
  });

  it("granted event (result:1) → ideResult 1", () => {
    const body = JSON.stringify({
      payload: { result: 1, time: "2026-05-29 15:11:00", user_id: 4240722371, actuator: 0 },
      transaction: { type: "access_event", "src-id": 289833329732592, "dst-id": 0 },
    });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.ideResult).toBe(1);
    expect(result.ideIoId).toBe(0);
  });

  it("heartbeat (user_id yok) IDE dalına DÜŞMEZ → user_id undefined (http.ts heartbeat olarak atlar)", () => {
    const body = JSON.stringify({
      payload: { TIME: "2026-05-29 15:08:14", IP: "192.168.1.4", WIFI_RSSI: null },
      transaction: { type: "heartbeat", "src-id": 289833329732592, "dst-id": 0 },
    });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBeUndefined();
    expect(result.ideIoId).toBeUndefined();
  });

  it("düz access-log objesi (actuator + uuid) IDE dalına düşer", () => {
    const body = JSON.stringify({ user_id: "777", actuator: 0, uuid: "Q711N586" });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("777");
    expect(result.ideIoId).toBe(0);
    expect(result.ideUuid).toBe("Q711N586");
    expect(result.serial).toBe("Q711N586");
  });
});

// ─── IDE result kodu → grant mapping (docs §6.3 + §9) ────────────────────────

describe("ideResultGranted", () => {
  it("1 = granted, 2 = granted-but-not-consumed, 3 = soft APB → hepsi grant (kapı açılır)", () => {
    expect(ideResultGranted(1)).toBe(true);
    expect(ideResultGranted(2)).toBe(true); // canlı doğrulandı 2026-05-31: result=2'de kapı açıldı
    expect(ideResultGranted(3)).toBe(true);
  });
  it("0 / bilinmeyen kod / undefined → reddedildi", () => {
    expect(ideResultGranted(0)).toBe(false);
    expect(ideResultGranted(4)).toBe(false);
    expect(ideResultGranted(undefined)).toBe(false);
  });
});

// ─── JSON Testleri ─────────────────────────────────────────────────────────

describe("parseCardReaderBody – JSON", () => {
  it("nested AccessControllerEvent içinden cardNo çıkarır", () => {
    const body = JSON.stringify({
      EventNotificationAlert: {
        ipAddress: "192.168.1.34",
        macAddress: "aa:bb:cc:dd:ee:ff",
        AccessControllerEvent: {
          cardNo: "0987654321",
          employeeNoString: "1",
          majorEventType: 5,
          subEventType: 75,
          doorNo: 1,
        },
      },
    });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("0987654321");
    expect(result.deviceIp).toBe("192.168.1.34");
  });

  it("macAddress'i serial olarak kullanır (nested yoksa)", () => {
    const body = JSON.stringify({
      EventNotificationAlert: {
        ipAddress: "192.168.1.34",
        macAddress: "aa:bb:cc:dd:ee:ff",
        AccessControllerEvent: {
          cardNo: "1111",
        },
      },
    });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.serial).toBe("aa:bb:cc:dd:ee:ff");
  });

  it("flat JSON (sadece cardNo + ipAddress)", () => {
    const body = JSON.stringify({
      cardNo: "TEST001",
      ipAddress: "192.168.1.34",
    });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("TEST001");
    expect(result.deviceIp).toBe("192.168.1.34");
  });

  it("employeeNoString alan adını kabul eder", () => {
    const body = JSON.stringify({ employeeNoString: "EMP42" });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("EMP42");
  });

  it("cardNumber alan adını kabul eder", () => {
    const body = JSON.stringify({ cardNumber: "CARD99" });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("CARD99");
  });

  it("credentialNo alan adını kabul eder", () => {
    const body = JSON.stringify({ credentialNo: "CRED55" });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("CRED55");
  });

  it("serialNumber'ı serial olarak çıkarır", () => {
    const body = JSON.stringify({ cardNo: "X", serialNumber: "SN-12345" });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.serial).toBe("SN-12345");
  });

  it("deviceSerialNo'yu serial olarak çıkarır", () => {
    const body = JSON.stringify({ cardNo: "X", deviceSerialNo: "DSN-999" });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.serial).toBe("DSN-999");
  });

  it("boş JSON body → tüm alanlar undefined", () => {
    const result = parseCardReaderBody("{}", "application/json");
    expect(result.user_id).toBeUndefined();
    expect(result.serial).toBeUndefined();
    expect(result.deviceIp).toBeUndefined();
  });

  it("sayı olarak gelen cardNo'yu stringe dönüştürür", () => {
    const body = JSON.stringify({ cardNo: 12345 });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("12345");
  });

  it("AcsEvent nested yapısından çıkarır", () => {
    const body = JSON.stringify({
      EventNotificationAlert: {
        ipAddress: "10.0.0.1",
        AcsEvent: { cardNo: "ACS001", serialNo: "SN-ACS" },
      },
    });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("ACS001");
  });

  it("user_id,serial formatını parse eder", () => {
    const body = JSON.stringify({ "user_id,serial": "CARD1,SERIAL1" });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBe("CARD1");
    expect(result.serial).toBe("SERIAL1");
  });
});

// ─── XML Testleri ──────────────────────────────────────────────────────────

describe("parseCardReaderBody – XML", () => {
  it("XML'den cardNo çıkarır", () => {
    const body = `<?xml version="1.0"?>
<EventNotificationAlert>
  <ipAddress>192.168.1.34</ipAddress>
  <AccessControllerEvent>
    <cardNo>XML001</cardNo>
    <serialNumber>SN-XML</serialNumber>
  </AccessControllerEvent>
</EventNotificationAlert>`;
    const result = parseCardReaderBody(body, "application/xml");
    expect(result.user_id).toBe("XML001");
    expect(result.serial).toBe("SN-XML");
    expect(result.deviceIp).toBe("192.168.1.34");
  });

  it("employeeNoString XML tag'inden çıkarır", () => {
    const body = `<Event><employeeNoString>EMP-XML</employeeNoString></Event>`;
    const result = parseCardReaderBody(body, "text/xml");
    expect(result.user_id).toBe("EMP-XML");
  });

  it("macAddress XML tag'inden serial çıkarır", () => {
    const body = `<Event><cardNo>X</cardNo><macAddress>aa:bb:cc</macAddress></Event>`;
    const result = parseCardReaderBody(body, "text/xml");
    expect(result.serial).toBe("aa:bb:cc");
  });
});

// ─── extractFromXmlOrMultipart ─────────────────────────────────────────────

describe("extractFromXmlOrMultipart", () => {
  it("tüm CARD_FIELDS tag adlarını tanır", () => {
    for (const field of CARD_FIELDS) {
      const xml = `<Root><${field}>TESTVAL</${field}></Root>`;
      const result = extractFromXmlOrMultipart(xml);
      expect(result.user_id, `${field} alanı tanınmalı`).toBe("TESTVAL");
    }
  });

  it("tüm SERIAL_FIELDS tag adlarını tanır", () => {
    for (const field of SERIAL_FIELDS) {
      const xml = `<Root><cardNo>X</cardNo><${field}>SN999</${field}></Root>`;
      const result = extractFromXmlOrMultipart(xml);
      expect(result.serial, `${field} alanı tanınmalı`).toBe("SN999");
    }
  });

  it("boş XML → undefined döner", () => {
    const result = extractFromXmlOrMultipart("<Root></Root>");
    expect(result.user_id).toBeUndefined();
    expect(result.serial).toBeUndefined();
  });
});

// ─── Multipart Testleri ────────────────────────────────────────────────────

describe("parseCardReaderBody – multipart", () => {
  it("multipart/form-data içindeki event_log JSON'unu parse eder", () => {
    const boundary = "MIME_boundary_1234";
    const eventJson = JSON.stringify({
      cardNo: "MULTI001",
      ipAddress: "192.168.1.34",
    });
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="event_log"`,
      `Content-Type: application/json`,
      ``,
      eventJson,
      `--${boundary}--`,
    ].join("\r\n");

    const contentType = `multipart/form-data; boundary=${boundary}`;
    const result = parseCardReaderBody(body, contentType);
    expect(result.user_id).toBe("MULTI001");
    expect(result.deviceIp).toBe("192.168.1.34");
  });

  it("multipart içinde nested AccessControllerEvent parse eder", () => {
    const boundary = "MIME_boundary_5678";
    const eventJson = JSON.stringify({
      EventNotificationAlert: {
        ipAddress: "10.0.0.5",
        macAddress: "11:22:33",
        AccessControllerEvent: {
          cardNo: "MULTI002",
        },
      },
    });
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="event_log"`,
      `Content-Type: application/json`,
      ``,
      eventJson,
      `--${boundary}--`,
    ].join("\r\n");

    const contentType = `multipart/form-data; boundary=${boundary}`;
    const result = parseCardReaderBody(body, contentType);
    expect(result.user_id).toBe("MULTI002");
    expect(result.serial).toBe("11:22:33");
  });
});

// ─── Edge Case / Hata Durumları ────────────────────────────────────────────

describe("parseCardReaderBody – edge cases", () => {
  it("boş string → tüm alanlar undefined", () => {
    const result = parseCardReaderBody("", "application/json");
    expect(result.user_id).toBeUndefined();
    expect(result.serial).toBeUndefined();
    expect(result.deviceIp).toBeUndefined();
  });

  it("geçersiz JSON → XML fallback dener, sonuç undefined", () => {
    const result = parseCardReaderBody("{invalid json}", "application/json");
    expect(result.user_id).toBeUndefined();
  });

  it("content-type null olsa bile JSON parse dener", () => {
    const body = JSON.stringify({ cardNo: "NO_CT" });
    const result = parseCardReaderBody(body, null);
    expect(result.user_id).toBe("NO_CT");
  });

  it("sadece boşluk içeren alan değerleri ignore edilir", () => {
    const body = JSON.stringify({ cardNo: "   " });
    const result = parseCardReaderBody(body, "application/json");
    expect(result.user_id).toBeUndefined();
  });
});
