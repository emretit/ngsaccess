/**
 * Hikvision ISAPI event katalogu.
 *
 * Amaç: PDKS geçiş olayları ile alarm/durum/operasyon olaylarını aynı ham
 * event akışından ayırmak. Bilinen access kodları cardReadings'e, access dışı
 * kodlar deviceEvents'e yönlendirilir.
 */

export const HIK_MAJOR_EVENT_TYPES = {
  DEVICE_ALARM: 1,
  DEVICE_EXCEPTION: 2,
  DEVICE_OPERATION: 3,
  DEVICE_EVENT: 5,
} as const;

export type AccessDecision = "izin_verildi" | "reddedildi" | undefined;
export type HikEventCategory =
  | "access"
  | "alarm"
  | "exception"
  | "operation"
  | "status"
  | "unknown";
export type HikEventSeverity = "info" | "warning" | "critical";

export interface HikEventCatalogEntry {
  major?: number;
  minor?: number;
  majorLabel: string;
  label: string;
  category: HikEventCategory;
  severity: HikEventSeverity;
  accessDecision?: AccessDecision;
  denialReason?: string;
  shouldCreateCardReading: boolean;
}

/**
 * subEventType (minor) -> izin verildi
 */
export const HIK_SUB_EVENT_GRANTED: ReadonlySet<number> = new Set([
  1, // Valid Card Auth Completed
  2, // Card + Password Auth Completed
  38, // Fingerprint Matched (0x26)
  75, // Face Authentication Completed (0x4B)
  76, // Face + Card Match (modele gore)
]);

/**
 * subEventType (minor) -> reddedildi
 */
export const HIK_SUB_EVENT_DENIED: ReadonlySet<number> = new Set([
  3, // Card + Password Auth Failed
  5, // Card Auth Timed Out
  6, // No Permission
  7, // Card Invalid Period
  8, // Expired Card
  9, // Card Not Exist
  10, // Anti-passing Back Auth Failed
  39, // Fingerprint Mismatched
  77, // Face Authentication Failed (modele gore)
  80, // Face Recognition Failed
  104, // Face Anti-Spoofing Failed
  113, // Blocklist Event
  148, // Password Auth Failed Times Exceeded
]);

/**
 * Spesifik ret nedeni - UI'da "Reddedildi (Yetki yok)" gibi gösterilir.
 */
export const HIK_DENIAL_REASONS: Record<number, string> = {
  3: "Şifre hatalı",
  5: "Kart okuma zaman aşımı",
  6: "Yetki yok",
  7: "Geçerlilik dışı (saat/tarih)",
  8: "Süresi dolmuş kart",
  9: "Kart tanımlı değil",
  10: "Anti-passback ihlali",
  39: "Parmak izi eşleşmedi",
  77: "Yüz tanıma başarısız",
  80: "Yüz tanınmadı",
  104: "Yüz canlılık testi başarısız",
  113: "Kara liste",
  148: "Şifre deneme limiti aşıldı",
};

const HIK_ACCESS_LABELS: Record<number, string> = {
  1: "Kart doğrulandı",
  2: "Kart + şifre doğrulandı",
  3: "Kart + şifre doğrulama başarısız",
  5: "Kart okuma zaman aşımı",
  6: "Yetki yok",
  7: "Kart geçerlilik zamanı dışında",
  8: "Kart süresi dolmuş",
  9: "Kart tanımlı değil",
  10: "Anti-passback ihlali",
  38: "Parmak izi eşleşti",
  39: "Parmak izi eşleşmedi",
  75: "Yüz doğrulandı",
  76: "Yüz + kart doğrulandı",
  77: "Yüz doğrulama başarısız",
  80: "Yüz tanıma başarısız",
  104: "Yüz canlılık testi başarısız",
  113: "Kara liste olayı",
  148: "Şifre deneme limiti aşıldı",
};

const HIK_MAJOR_LABELS: Record<number, string> = {
  [HIK_MAJOR_EVENT_TYPES.DEVICE_ALARM]: "Cihaz alarmı",
  [HIK_MAJOR_EVENT_TYPES.DEVICE_EXCEPTION]: "Cihaz istisnası",
  [HIK_MAJOR_EVENT_TYPES.DEVICE_OPERATION]: "Cihaz operasyonu",
  [HIK_MAJOR_EVENT_TYPES.DEVICE_EVENT]: "Cihaz olayı",
};

const HIK_ALARM_LABELS: Record<number, string> = {
  1024: "Kapı açık alarmı",
  1025: "Kapı kapalı alarmı",
  1026: "Kapı zorlandı alarmı",
  1027: "Kapı uzun süre açık alarmı",
  1030: "Okuyucu sabotaj alarmı",
  1031: "Okuyucu sabotaj alarmı normale döndü",
  1032: "Alarm girişi tetiklendi",
  1033: "Alarm girişi normale döndü",
};

const HIK_OPERATION_LABELS: Record<number, string> = {
  80: "Uzaktan kapı açma",
  90: "Cihaz yeniden başlatma",
  1024: "Kapı kontrol operasyonu",
};

export function inferDenialReason(subEventType: number | undefined): string | undefined {
  if (subEventType === undefined) return undefined;
  return HIK_DENIAL_REASONS[subEventType];
}

export function inferAccessStatus(
  majorEventType: number | undefined,
  subEventType: number | undefined,
): AccessDecision {
  return classifyHikEvent(majorEventType, subEventType).accessDecision;
}

export function shouldCreateCardReadingForHikEvent(
  majorEventType: number | undefined,
  subEventType: number | undefined,
  hasCardNo: boolean,
): boolean {
  const entry = classifyHikEvent(majorEventType, subEventType);
  if (entry.shouldCreateCardReading) return true;

  // Legacy uyumluluk: Hikvision DEVICE_EVENT içinde henüz kataloglamadığımız
  // ama kart numarası taşıyan event'leri PDKS audit'inden düşürmeyelim.
  if (
    hasCardNo &&
    majorEventType === HIK_MAJOR_EVENT_TYPES.DEVICE_EVENT &&
    subEventType !== undefined
  ) {
    return true;
  }

  // Eski/non-Hik akışlarda major/minor yoksa kart okuyucu POST'u işlenmeye devam eder.
  if (hasCardNo && majorEventType === undefined && subEventType === undefined) {
    return true;
  }

  return false;
}

export function classifyHikEvent(
  majorEventType: number | undefined,
  subEventType: number | undefined,
): HikEventCatalogEntry {
  const majorLabel =
    majorEventType === undefined
      ? "Bilinmeyen major"
      : HIK_MAJOR_LABELS[majorEventType] ?? `Bilinmeyen major ${majorEventType}`;

  if (
    (majorEventType === HIK_MAJOR_EVENT_TYPES.DEVICE_EVENT ||
      majorEventType === HIK_MAJOR_EVENT_TYPES.DEVICE_ALARM) &&
    subEventType !== undefined
  ) {
    if (HIK_SUB_EVENT_GRANTED.has(subEventType)) {
      return {
        major: majorEventType,
        minor: subEventType,
        majorLabel,
        label: HIK_ACCESS_LABELS[subEventType] ?? `Geçiş izni (${subEventType})`,
        category: "access",
        severity: "info",
        accessDecision: "izin_verildi",
        shouldCreateCardReading: true,
      };
    }
    if (HIK_SUB_EVENT_DENIED.has(subEventType)) {
      return {
        major: majorEventType,
        minor: subEventType,
        majorLabel,
        label: HIK_ACCESS_LABELS[subEventType] ?? `Geçiş reddi (${subEventType})`,
        category: "access",
        severity: "warning",
        accessDecision: "reddedildi",
        denialReason: inferDenialReason(subEventType),
        shouldCreateCardReading: true,
      };
    }
  }

  if (majorEventType === HIK_MAJOR_EVENT_TYPES.DEVICE_ALARM) {
    return {
      major: majorEventType,
      minor: subEventType,
      majorLabel,
      label:
        subEventType === undefined
          ? majorLabel
          : HIK_ALARM_LABELS[subEventType] ?? `Alarm olayı (${subEventType})`,
      category: "alarm",
      severity: "warning",
      shouldCreateCardReading: false,
    };
  }

  if (majorEventType === HIK_MAJOR_EVENT_TYPES.DEVICE_EXCEPTION) {
    return {
      major: majorEventType,
      minor: subEventType,
      majorLabel,
      label:
        subEventType === undefined
          ? majorLabel
          : `Cihaz istisnası (${subEventType})`,
      category: "exception",
      severity: "warning",
      shouldCreateCardReading: false,
    };
  }

  if (majorEventType === HIK_MAJOR_EVENT_TYPES.DEVICE_OPERATION) {
    return {
      major: majorEventType,
      minor: subEventType,
      majorLabel,
      label:
        subEventType === undefined
          ? majorLabel
          : HIK_OPERATION_LABELS[subEventType] ?? `Cihaz operasyonu (${subEventType})`,
      category: "operation",
      severity: "info",
      shouldCreateCardReading: false,
    };
  }

  if (majorEventType === HIK_MAJOR_EVENT_TYPES.DEVICE_EVENT) {
    return {
      major: majorEventType,
      minor: subEventType,
      majorLabel,
      label:
        subEventType === undefined
          ? majorLabel
          : `Cihaz durum olayı (${subEventType})`,
      category: "status",
      severity: "info",
      shouldCreateCardReading: false,
    };
  }

  return {
    major: majorEventType,
    minor: subEventType,
    majorLabel,
    label:
      subEventType === undefined
        ? "Bilinmeyen Hikvision olayı"
        : `Bilinmeyen Hikvision olayı (${subEventType})`,
    category: "unknown",
    severity: "info",
    shouldCreateCardReading: false,
  };
}
