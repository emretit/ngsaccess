/**
 * Kart okuyucu (Hikvision vb.) event body parse – tablo ile uyumlu alan eşlemesi.
 * Tek kaynak: cardNo/user_id ve deviceSerial/serial çıktısı processCardReading ile uyumlu.
 * Bkz. docs/TABLO_PARSE_UYUMLULUK.md
 */

/** Hikvision kart/kimlik alan adları (sırayla kontrol, ilk bulunan kullanılır) */
export const CARD_FIELDS = [
  "cardNo",
  "cardNumber",
  "credentialNo",
  "credentialsNo",
  "employeeNo",
  "employeeNoString",
  "currentCardNumber",
  "wiegandCardNo",
  "cardReaderNo",
] as const;

/** Hikvision cihaz seri no alan adları */
export const SERIAL_FIELDS = [
  "serialNumber",
  "deviceSerialNo",
  "deviceSerial",
  "deviceID",
  "serialNo",
  "macAddress",
] as const;

export type CardReaderParseResult = {
  user_id: string | undefined;
  serial: string | undefined;
  /** Cihaz IP (event'te genelde üst seviyede ipAddress); serial yoksa cihaz eşlemesi için kullanılır */
  deviceIp: string | undefined;
  bodyForLog: Record<string, unknown>;
  // Hikvision-spesifik event alanları (Device Gateway / ISAPI event push)
  hikDevIndex?: string;
  hikMajorEventType?: number;
  hikSubEventType?: number;
  hikCurrentVerifyMode?: string;
  hikSerialNo?: number;
  hikFrontSerialNo?: number;
  hikDateTime?: string;
  hikPictureURL?: string;
  hikMask?: string;
  hikHelmet?: string;
  hikTemperature?: number;
  hikEventState?: string;
  /** Cihazın ehome/device ID'si (gateway register ederken atadığımız değer). */
  hikEhomeID?: string;
};

function getFirstString(
  obj: Record<string, unknown>,
  fields: ReadonlyArray<string>
): string | undefined {
  for (const f of fields) {
    const v = obj[f];
    if (v != null && typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return undefined;
}

function getFirstNumber(
  obj: Record<string, unknown>,
  fields: ReadonlyArray<string>
): number | undefined {
  for (const f of fields) {
    const v = obj[f];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

type HikEventFields = Pick<
  CardReaderParseResult,
  | "hikDevIndex"
  | "hikMajorEventType"
  | "hikSubEventType"
  | "hikCurrentVerifyMode"
  | "hikSerialNo"
  | "hikFrontSerialNo"
  | "hikDateTime"
  | "hikPictureURL"
  | "hikMask"
  | "hikHelmet"
  | "hikTemperature"
  | "hikEventState"
  | "hikEhomeID"
>;

/** Hikvision event-spesifik alanları aday objelerden çıkarır */
function extractHikEventFields(
  candidates: Array<Record<string, unknown> | undefined>,
): HikEventFields {
  const result: HikEventFields = {};

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    if (result.hikDevIndex === undefined) {
      result.hikDevIndex = getFirstString(c, ["devIndex", "devID", "deviceIndex"]);
    }
    if (result.hikEhomeID === undefined) {
      result.hikEhomeID = getFirstString(c, ["deviceID", "DeviceID", "ehomeID"]);
    }
    if (result.hikMajorEventType === undefined) {
      result.hikMajorEventType = getFirstNumber(c, ["majorEventType", "eventType"]);
    }
    if (result.hikSubEventType === undefined) {
      result.hikSubEventType = getFirstNumber(c, [
        "subEventType",
        "minorEventType",
        "subEventTypeCode",
      ]);
    }
    if (result.hikCurrentVerifyMode === undefined) {
      result.hikCurrentVerifyMode = getFirstString(c, [
        "currentVerifyMode",
        "verifyMode",
      ]);
    }
    if (result.hikSerialNo === undefined) {
      result.hikSerialNo = getFirstNumber(c, ["serialNo", "eventSerialNo"]);
    }
    if (result.hikFrontSerialNo === undefined) {
      result.hikFrontSerialNo = getFirstNumber(c, ["frontSerialNo"]);
    }
    if (result.hikDateTime === undefined) {
      result.hikDateTime = getFirstString(c, ["dateTime", "eventDateTime"]);
    }
    if (result.hikPictureURL === undefined) {
      result.hikPictureURL = getFirstString(c, [
        "pictureURL",
        "picURL",
        "subPicURL",
        "snapshotURL",
      ]);
    }
    if (result.hikMask === undefined) {
      result.hikMask = getFirstString(c, ["mask", "maskWearStatus"]);
    }
    if (result.hikHelmet === undefined) {
      result.hikHelmet = getFirstString(c, ["helmet", "helmetWearStatus"]);
    }
    if (result.hikTemperature === undefined) {
      result.hikTemperature = getFirstNumber(c, [
        "currentTemperature",
        "temperature",
      ]);
    }
    if (result.hikEventState === undefined) {
      result.hikEventState = getFirstString(c, ["eventState"]);
    }
  }
  return result;
}

/** XML/multipart body'den Hikvision alanlarını regex ile çıkarır */
export function extractFromXmlOrMultipart(raw: string): {
  user_id: string | undefined;
  serial: string | undefined;
} {
  const cardTags = [...CARD_FIELDS];
  const serialTags = [...SERIAL_FIELDS];
  let user_id: string | undefined;
  let serial: string | undefined;
  for (const tag of cardTags) {
    const m = raw.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
    if (m?.[1]?.trim()) {
      user_id = m[1].trim();
      break;
    }
  }
  for (const tag of serialTags) {
    const m = raw.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
    if (m?.[1]?.trim()) {
      serial = m[1].trim();
      break;
    }
  }
  return { user_id, serial };
}

/**
 * multipart/form-data body'den event_log (veya ilk application/json) part'ının gövdesini döndürür.
 * Hikvision bazen event'i multipart içinde JSON olarak gönderir.
 */
function extractJsonFromMultipart(raw: string, contentType: string | null): string | null {
  if (!contentType?.includes("multipart/form-data")) return null;
  const boundaryMatch = contentType.match(/boundary=([^;\s]+)/);
  const boundary = boundaryMatch?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (!boundary) return null;

  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = raw.split(new RegExp(`\\r?\\n--${escapedBoundary}(?:\\r?\\n|$)`));
  for (const part of parts) {
    const nameMatch = part.match(/name="([^"]+)"/);
    const isJson =
      part.includes("Content-Type: application/json") ||
      part.includes("application/json");
    const doubleCrlf = part.indexOf("\r\n\r\n");
    const bodyStart =
      doubleCrlf >= 0
        ? doubleCrlf + 4
        : part.indexOf("\n\n") >= 0
          ? part.indexOf("\n\n") + 2
          : -1;
    if (bodyStart < 0) continue;
    let body = part.slice(bodyStart).replace(/\r\n$/, "").trim();
    // Part sonunda bir sonraki boundary kalabilir (örn. \r\n--MIME_boundary--), JSON'u kes
    const boundaryEnd = body.search(/\r?\n--/);
    if (boundaryEnd >= 0) body = body.slice(0, boundaryEnd).trim();
    if (nameMatch?.[1] === "event_log" && body) return body;
    if (isJson && body.startsWith("{") && body) return body;
  }
  return null;
}

/**
 * Hikvision bazen kartı üst seviyede değil, EventNotificationAlert içindeki
 * AccessControllerEvent / AcsEvent alt nesnesinde gönderir; ilk anlamlı objeyi seçer.
 */
function pickHikvisionPayload(body: Record<string, unknown>): Record<string, unknown> {
  const eventAlert = body.EventNotificationAlert as
    | Record<string, unknown>
    | undefined;
  const acsEvent = body.AcsEvent as Record<string, unknown> | undefined;
  const acEvent = body.AccessControllerEvent as Record<string, unknown> | undefined;

  const candidates: Array<Record<string, unknown> | undefined> = [
    eventAlert,
    eventAlert?.AccessControllerEvent as Record<string, unknown> | undefined,
    eventAlert?.AcsEvent as Record<string, unknown> | undefined,
    acsEvent,
    acEvent,
    body,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    if (getFirstString(c, CARD_FIELDS)) return c;
  }
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    if (getFirstString(c, SERIAL_FIELDS)) return c;
  }
  return eventAlert ?? acsEvent ?? acEvent ?? body;
}

/**
 * Raw body'den user_id (kart no) ve serial (cihaz seri no) çıkarır.
 * Çıktı processCardReading({ cardNo, deviceSerial, rawBody }) ile uyumludur:
 *   cardNo = user_id, deviceSerial = serial
 */
export function parseCardReaderBody(
  raw: string,
  contentType: string | null
): CardReaderParseResult {
  let jsonSource: string = raw;

  if (contentType?.includes("multipart/form-data")) {
    const jsonPart = extractJsonFromMultipart(raw, contentType);
    if (jsonPart) jsonSource = jsonPart;
  }

  const trimmedSource = jsonSource.trim();
  if (
    (trimmedSource.startsWith("{") && trimmedSource.endsWith("}")) ||
    contentType?.includes("application/json")
  ) {
    try {
      const body = JSON.parse(jsonSource) as Record<string, unknown>;
      const payload = pickHikvisionPayload(body);
      let user_id = getFirstString(payload as Record<string, unknown>, CARD_FIELDS);
      let serial = getFirstString(payload as Record<string, unknown>, SERIAL_FIELDS);
      // Serial üst seviye body'de olabilir (örn. macAddress, serialNumber)
      if (!serial && payload !== body) {
        serial = getFirstString(body, SERIAL_FIELDS);
      }
      if (!user_id && (body["user_id,serial"] || body.CARD_NO)) {
        const s =
          (body["user_id,serial"] as string) || (body.CARD_NO as string);
        const [cardNumber, deviceSerial] = String(s).split(",");
        user_id = cardNumber?.trim();
        serial = deviceSerial?.trim();
      }
      if (!user_id) user_id = body.user_id as string | undefined;
      if (!serial) serial = body.serial as string | undefined;
      const nestedAlert = body.EventNotificationAlert as
        | Record<string, unknown>
        | undefined;
      const nestedAc = nestedAlert?.AccessControllerEvent as
        | Record<string, unknown>
        | undefined;
      const deviceIp =
        (body.ipAddress as string)?.trim() ||
        (payload && (payload as Record<string, unknown>).ipAddress as string)?.trim() ||
        nestedAlert?.ipAddress as string | undefined ||
        nestedAc?.ipAddress as string | undefined;
      if (!serial) {
        serial =
          getFirstString(nestedAc ?? {}, SERIAL_FIELDS) ||
          getFirstString(nestedAlert ?? {}, SERIAL_FIELDS);
      }
      const hikFields = extractHikEventFields([
        payload as Record<string, unknown>,
        nestedAc,
        nestedAlert,
        body,
      ]);
      return {
        user_id,
        serial,
        deviceIp: deviceIp || undefined,
        bodyForLog: body,
        ...hikFields,
      };
    } catch {
      /* JSON parse hatası, XML/multipart'a geç */
    }
  }

  if (raw.includes("<") && raw.includes(">")) {
    const { user_id, serial } = extractFromXmlOrMultipart(raw);
    const ipMatch = raw.match(/<ipAddress>([^<]+)<\/ipAddress>/i);
    const deviceIp = ipMatch?.[1]?.trim() || undefined;
    const num = (tag: string): number | undefined => {
      const m = raw.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
      const n = m?.[1]?.trim();
      return n && !Number.isNaN(Number(n)) ? Number(n) : undefined;
    };
    const str = (tag: string): string | undefined => {
      const m = raw.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
      return m?.[1]?.trim() || undefined;
    };
    return {
      user_id,
      serial,
      deviceIp,
      bodyForLog: { _raw: raw.slice(0, 500), _format: "xml/multipart" },
      hikDevIndex: str("devIndex"),
      hikMajorEventType: num("majorEventType"),
      hikSubEventType: num("subEventType"),
      hikCurrentVerifyMode: str("currentVerifyMode"),
      hikSerialNo: num("serialNo"),
      hikFrontSerialNo: num("frontSerialNo"),
      hikDateTime: str("dateTime"),
      hikPictureURL: str("pictureURL") ?? str("picURL"),
    };
  }

  return {
    user_id: undefined,
    serial: undefined,
    deviceIp: undefined,
    bodyForLog: { _raw: raw.slice(0, 500), _format: "unknown" },
  };
}
