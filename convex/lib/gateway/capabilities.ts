"use node";

import { gatewayApiCall } from "./core";

export interface HikCapabilityProbe {
  key: string;
  label: string;
  endpoint: string;
  supportFields: string[];
}

export interface HikCapabilityProbeResult {
  key: string;
  label: string;
  endpoint: string;
  ok: boolean;
  supported: boolean | null;
  matchedField?: string;
  error?: string;
  rawPreview?: string;
}

export interface HikCapabilitySnapshot {
  version: 1;
  updatedAt: number;
  probes: HikCapabilityProbeResult[];
}

const RAW_PREVIEW_LIMIT = 4000;

const CAPABILITY_PROBES: readonly HikCapabilityProbe[] = [
  {
    key: "accessControl",
    label: "Access Control genel yetenekleri",
    endpoint: "/ISAPI/AccessControl/capabilities",
    supportFields: ["isSupportAccessControl", "isSupportAcs"],
  },
  {
    key: "acsEvent",
    label: "Gecmis access event arama",
    endpoint: "/ISAPI/AccessControl/AcsEvent/capabilities",
    supportFields: ["isSupportAcsEvent", "isSupportSearch"],
  },
  {
    key: "acsEventTotalNum",
    label: "Event toplam sayisi",
    endpoint: "/ISAPI/AccessControl/AcsEventTotalNum/capabilities",
    supportFields: ["isSupportAcsEventTotalNum"],
  },
  {
    key: "acsWorkStatus",
    label: "Cihaz calisma durumu",
    endpoint: "/ISAPI/AccessControl/AcsWorkStatus/capabilities",
    supportFields: ["isSupportAcsWorkStatus"],
  },
  {
    key: "person",
    label: "Kisi yonetimi",
    endpoint: "/ISAPI/AccessControl/UserInfo/capabilities",
    supportFields: ["isSupportUserInfo", "isSupportUserInfoRecord"],
  },
  {
    key: "card",
    label: "Kart yonetimi",
    endpoint: "/ISAPI/AccessControl/CardInfo/capabilities",
    supportFields: ["isSupportCardInfo", "isSupportCardInfoRecord"],
  },
  {
    key: "cardReaderCfg",
    label: "Okuyucu konfigrasyonu",
    endpoint: "/ISAPI/AccessControl/CardReaderCfg/capabilities",
    supportFields: ["isSupportCardReaderCfg"],
  },
  {
    key: "cardReaderPlan",
    label: "Okuyucu dogrulama plani",
    endpoint: "/ISAPI/AccessControl/CardReaderPlan/capabilities",
    supportFields: ["isSupportCardReaderPlan"],
  },
  {
    key: "captureCard",
    label: "Canli kart okutma",
    endpoint: "/ISAPI/AccessControl/CaptureCardInfo/capabilities",
    supportFields: ["isSupportCaptureCardInfo"],
  },
  {
    key: "captureFingerprint",
    label: "Canli parmak izi alma",
    endpoint: "/ISAPI/AccessControl/CaptureFingerPrint/capabilities",
    supportFields: ["isSupportCaptureFingerPrint"],
  },
  {
    key: "fingerprintCfg",
    label: "Parmak izi yonetimi",
    endpoint: "/ISAPI/AccessControl/FingerPrintCfg/capabilities",
    supportFields: ["isSupportFingerPrint", "isSupportFingerPrintCfg"],
  },
  {
    key: "remoteDoor",
    label: "Uzaktan kapi kontrolu",
    endpoint: "/ISAPI/AccessControl/RemoteControl/door/capabilities",
    supportFields: ["isSupportRemoteControlDoor"],
  },
  {
    key: "doorParam",
    label: "Kapi parametreleri",
    endpoint: "/ISAPI/AccessControl/Door/capabilities",
    supportFields: ["isSupportDoorParam", "isSupportDoor"],
  },
  {
    key: "doorStatusPlan",
    label: "Kapi durum plani",
    endpoint: "/ISAPI/AccessControl/DoorStatusPlan/capabilities",
    supportFields: ["isSupportDoorStatusPlan"],
  },
  {
    key: "doorStatusWeekPlan",
    label: "Kapi durum haftalik plani",
    endpoint: "/ISAPI/AccessControl/DoorStatusWeekPlanCfg/capabilities",
    supportFields: ["isSupportDoorStatusWeekPlanCfg"],
  },
  {
    key: "doorStatusHoliday",
    label: "Kapi durum tatil plani",
    endpoint: "/ISAPI/AccessControl/DoorStatusHolidayPlanCfg/capabilities",
    supportFields: ["isSupportDoorStatusHolidayPlanCfg"],
  },
  {
    key: "verifyPlanTemplate",
    label: "Dogrulama plan template",
    endpoint: "/ISAPI/AccessControl/VerifyPlanTemplate/capabilities",
    supportFields: ["isSupportVerifyPlanTemplate"],
  },
  {
    key: "verifyWeekPlan",
    label: "Dogrulama haftalik plani",
    endpoint: "/ISAPI/AccessControl/VerifyWeekPlanCfg/capabilities",
    supportFields: ["isSupportVerifyWeekPlanCfg"],
  },
  {
    key: "verifyHoliday",
    label: "Dogrulama tatil plani",
    endpoint: "/ISAPI/AccessControl/VerifyHolidayPlanCfg/capabilities",
    supportFields: ["isSupportVerifyHolidayPlanCfg"],
  },
  {
    key: "userRightHoliday",
    label: "Kisi yetki tatil plani",
    endpoint: "/ISAPI/AccessControl/UserRightHolidayPlanCfg/capabilities",
    supportFields: ["isSupportUserRightHolidayPlanCfg"],
  },
  {
    key: "faceRecognizeMode",
    label: "Yuz tanima modu",
    endpoint: "/ISAPI/AccessControl/FaceRecognizeMode/capabilities",
    supportFields: ["isSupportFaceRecognizeMode"],
  },
  {
    key: "antiPassback",
    label: "Anti-passback",
    endpoint: "/ISAPI/AccessControl/AntiSneakCfg/capabilities",
    supportFields: ["isSupportAntiSneakCfg"],
  },
  {
    key: "cardReaderAntiPassback",
    label: "Okuyucu anti-passback",
    endpoint: "/ISAPI/AccessControl/CardReaderAntiSneakCfg/capabilities",
    supportFields: ["isSupportCardReaderAntiSneakCfg"],
  },
  {
    key: "antiPassbackTimeRange",
    label: "Anti-passback zaman araligi",
    endpoint: "/ISAPI/AccessControl/AntiPassback/timeRange/capabilities",
    supportFields: ["isSupportAntiPassbackTimeRange"],
  },
  {
    key: "eventCardLinkage",
    label: "Event-kart linkage",
    endpoint: "/ISAPI/AccessControl/EventCardLinkageCfg/capabilities",
    supportFields: ["isSupportEventCardLinkageCfg"],
  },
  {
    key: "qrCode",
    label: "Hikvision QR credential/event",
    endpoint: "/ISAPI/AccessControl/QRCodeInfo/capabilities",
    supportFields: ["isSupportQRCodeInfo"],
  },
  {
    key: "iris",
    label: "Iris credential",
    endpoint: "/ISAPI/AccessControl/IrisInfo/capabilities",
    supportFields: ["isSupportIrisInfo"],
  },
  {
    key: "nfc",
    label: "NFC konfigrasyonu",
    endpoint: "/ISAPI/AccessControl/Configuration/NFCCfg/capabilities",
    supportFields: ["isSupportNFCCfg"],
  },
  {
    key: "rfCard",
    label: "RF kart konfigrasyonu",
    endpoint: "/ISAPI/AccessControl/Configuration/RFCardCfg/capabilities",
    supportFields: ["isSupportRFCardCfg"],
  },
  {
    key: "wiegand",
    label: "Wiegand konfigrasyonu",
    endpoint: "/ISAPI/AccessControl/WiegandCfg/capabilities",
    supportFields: ["isSupportWiegandCfg"],
  },
  {
    key: "localAttendance",
    label: "Cihaz ici local attendance",
    endpoint: "/ISAPI/AccessControl/LocalAttendance/rule/capabilities",
    supportFields: ["isSupportLocalAttendanceRule"],
  },
];

export function listHikCapabilityProbes(): readonly HikCapabilityProbe[] {
  return CAPABILITY_PROBES;
}

export async function fetchHikCapabilitySnapshot(
  devIndex: string,
): Promise<HikCapabilitySnapshot> {
  const probes = await Promise.all(
    CAPABILITY_PROBES.map((probe) => runCapabilityProbe(devIndex, probe)),
  );
  return {
    version: 1,
    updatedAt: Date.now(),
    probes,
  };
}

async function runCapabilityProbe(
  devIndex: string,
  probe: HikCapabilityProbe,
): Promise<HikCapabilityProbeResult> {
  try {
    const result = await gatewayApiCall(probe.endpoint, "GET", null, devIndex);
    const rawPreview = result.raw.slice(0, RAW_PREVIEW_LIMIT);
    if (result.status !== 200) {
      return {
        key: probe.key,
        label: probe.label,
        endpoint: probe.endpoint,
        ok: false,
        supported: false,
        error: `HTTP ${result.status}: ${result.raw.slice(0, 200)}`,
        rawPreview,
      };
    }

    const support = findSupportFlag(result.data, probe.supportFields);
    return {
      key: probe.key,
      label: probe.label,
      endpoint: probe.endpoint,
      ok: true,
      supported: support?.value ?? null,
      matchedField: support?.field,
      rawPreview,
    };
  } catch (e) {
    return {
      key: probe.key,
      label: probe.label,
      endpoint: probe.endpoint,
      ok: false,
      supported: false,
      error: e instanceof Error ? e.message : "Capability probe failed",
    };
  }
}

function findSupportFlag(
  value: unknown,
  fields: readonly string[],
): { field: string; value: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;

  for (const field of fields) {
    const parsed = parseBooleanLike(obj[field]);
    if (parsed !== null) return { field, value: parsed };
  }

  for (const [key, child] of Object.entries(obj)) {
    if (key === "rawPreview") continue;
    const nested = findSupportFlag(child, fields);
    if (nested) return nested;
  }

  return null;
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
    if (normalized === "false" || normalized === "no" || normalized === "0") return false;
  }
  return null;
}

