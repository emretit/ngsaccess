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

interface HikAccessCode {
  decision: "izin_verildi" | "reddedildi";
  label: string;
  /** Yalnız ret kodlarında: UI'da "Reddedildi (Yetki yok)" gibi gösterilir. */
  reason?: string;
}

/**
 * MAJOR_EVENT (0x5) access minor kodları — tek kaynak.
 * Kaynak: "Access Control Event Types and Event Linkage Types" (ISAPI) +
 * Device Network SDK MINOR_* tablosu (docs/sdk/appendix-c/c.1-access-control-event-types.md).
 * Kapı/röle/buton durum kodları (0x11-0x25, 0x51-0x64 …) burada YOK → status olarak kalır.
 */
const HIK_ACCESS_CODES: Readonly<Record<number, HikAccessCode>> = {
  0x01: { decision: "izin_verildi", label: "Kart doğrulandı" },
  0x02: { decision: "izin_verildi", label: "Kart + şifre doğrulandı" },
  0x03: { decision: "reddedildi", label: "Kart + şifre doğrulama başarısız", reason: "Şifre hatalı" },
  0x04: { decision: "reddedildi", label: "Kart + şifre zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x05: { decision: "reddedildi", label: "Kart okuma zaman aşımı", reason: "Kart okuma zaman aşımı" },
  0x06: { decision: "reddedildi", label: "Yetki yok", reason: "Yetki yok" },
  0x07: { decision: "reddedildi", label: "Kart geçerlilik zamanı dışında", reason: "Geçerlilik dışı (saat/tarih)" },
  0x08: { decision: "reddedildi", label: "Kart süresi dolmuş", reason: "Süresi dolmuş kart" },
  0x09: { decision: "reddedildi", label: "Kart tanımlı değil", reason: "Kart tanımlı değil" },
  0x0a: { decision: "reddedildi", label: "Anti-passback ihlali", reason: "Anti-passback ihlali" },
  0x0b: { decision: "reddedildi", label: "Kilitli kapı kapanmadı (interlock)", reason: "Interlock kapısı açık" },
  0x0c: { decision: "reddedildi", label: "Kart çoklu doğrulama grubunda değil", reason: "Çoklu doğrulama grubu dışında" },
  0x0d: { decision: "reddedildi", label: "Çoklu doğrulama süresi dışında", reason: "Çoklu doğrulama süresi dışında" },
  0x0e: { decision: "reddedildi", label: "Süper şifre doğrulama başarısız", reason: "Süper şifre hatalı" },
  0x26: { decision: "izin_verildi", label: "Parmak izi eşleşti" },
  0x27: { decision: "reddedildi", label: "Parmak izi eşleşmedi", reason: "Parmak izi eşleşmedi" },
  0x28: { decision: "izin_verildi", label: "Kart + parmak izi doğrulandı" },
  0x29: { decision: "reddedildi", label: "Kart + parmak izi başarısız", reason: "Parmak izi eşleşmedi" },
  0x2a: { decision: "reddedildi", label: "Kart + parmak izi zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x2b: { decision: "izin_verildi", label: "Kart + parmak izi + şifre doğrulandı" },
  0x2c: { decision: "reddedildi", label: "Kart + parmak izi + şifre başarısız", reason: "Çoklu doğrulama başarısız" },
  0x2d: { decision: "reddedildi", label: "Kart + parmak izi + şifre zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x2e: { decision: "izin_verildi", label: "Parmak izi + şifre doğrulandı" },
  0x2f: { decision: "reddedildi", label: "Parmak izi + şifre başarısız", reason: "Çoklu doğrulama başarısız" },
  0x30: { decision: "reddedildi", label: "Parmak izi + şifre zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x31: { decision: "reddedildi", label: "Parmak izi tanımlı değil", reason: "Parmak izi tanımlı değil" },
  0x36: { decision: "izin_verildi", label: "Yüz + parmak izi doğrulandı" },
  0x37: { decision: "reddedildi", label: "Yüz + parmak izi başarısız", reason: "Çoklu doğrulama başarısız" },
  0x38: { decision: "reddedildi", label: "Yüz + parmak izi zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x39: { decision: "izin_verildi", label: "Yüz + PIN doğrulandı" },
  0x3a: { decision: "reddedildi", label: "Yüz + PIN başarısız", reason: "Çoklu doğrulama başarısız" },
  0x3b: { decision: "reddedildi", label: "Yüz + PIN zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x3c: { decision: "izin_verildi", label: "Yüz + kart doğrulandı" },
  0x3d: { decision: "reddedildi", label: "Yüz + kart başarısız", reason: "Çoklu doğrulama başarısız" },
  0x3e: { decision: "reddedildi", label: "Yüz + kart zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x3f: { decision: "izin_verildi", label: "Yüz + PIN + parmak izi doğrulandı" },
  0x40: { decision: "reddedildi", label: "Yüz + PIN + parmak izi başarısız", reason: "Çoklu doğrulama başarısız" },
  0x41: { decision: "reddedildi", label: "Yüz + PIN + parmak izi zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x42: { decision: "izin_verildi", label: "Yüz + kart + parmak izi doğrulandı" },
  0x43: { decision: "reddedildi", label: "Yüz + kart + parmak izi başarısız", reason: "Çoklu doğrulama başarısız" },
  0x44: { decision: "reddedildi", label: "Yüz + kart + parmak izi zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x45: { decision: "izin_verildi", label: "Personel no + parmak izi doğrulandı" },
  0x46: { decision: "reddedildi", label: "Personel no + parmak izi başarısız", reason: "Parmak izi eşleşmedi" },
  0x47: { decision: "reddedildi", label: "Personel no + parmak izi zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x48: { decision: "izin_verildi", label: "Personel no + parmak izi + şifre doğrulandı" },
  0x49: { decision: "reddedildi", label: "Personel no + parmak izi + şifre başarısız", reason: "Çoklu doğrulama başarısız" },
  0x4a: { decision: "reddedildi", label: "Personel no + parmak izi + şifre zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x4b: { decision: "izin_verildi", label: "Yüz doğrulandı" },
  0x4c: { decision: "reddedildi", label: "Yüz doğrulama başarısız", reason: "Yüz tanıma başarısız" },
  0x4d: { decision: "izin_verildi", label: "Personel no + yüz doğrulandı" },
  0x4e: { decision: "reddedildi", label: "Personel no + yüz başarısız", reason: "Yüz tanıma başarısız" },
  0x4f: { decision: "reddedildi", label: "Personel no + yüz zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x50: { decision: "reddedildi", label: "Yüz tanıma başarısız", reason: "Yüz tanınmadı" },
  0x65: { decision: "izin_verildi", label: "Personel no + şifre doğrulandı" },
  0x66: { decision: "reddedildi", label: "Personel no + şifre başarısız", reason: "Şifre hatalı" },
  0x67: { decision: "reddedildi", label: "Personel no + şifre zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x68: { decision: "reddedildi", label: "Yüz canlılık testi başarısız", reason: "Yüz canlılık testi başarısız" },
  0x69: { decision: "izin_verildi", label: "Kişi + kimlik kartı eşleşti" },
  0x70: { decision: "reddedildi", label: "Kişi + kimlik kartı eşleşmedi", reason: "Kimlik kartı eşleşmedi" },
  0x71: { decision: "reddedildi", label: "Kara liste olayı", reason: "Kara liste" },
  0x75: { decision: "reddedildi", label: "Kapı kapalı/uyku modunda", reason: "Kapı kapalı/uyku modu" },
  0x76: { decision: "reddedildi", label: "Doğrulama planı uyku modunda", reason: "Doğrulama planı dışında" },
  0x77: { decision: "reddedildi", label: "Kart şifreleme doğrulaması başarısız", reason: "Kart şifreleme hatası" },
  0x78: { decision: "reddedildi", label: "Anti-passback sunucu yanıtı başarısız", reason: "Anti-passback sunucu hatası" },
  0x8b: { decision: "reddedildi", label: "Serbest geçişte doğrulama başarısız", reason: "Doğrulama başarısız" },
  0x94: { decision: "reddedildi", label: "Şifre deneme limiti aşıldı", reason: "Şifre deneme limiti aşıldı" },
  0x96: { decision: "reddedildi", label: "Şifre doğrulama başarısız", reason: "Şifre hatalı" },
  0x97: { decision: "reddedildi", label: "Şifreler eşleşmedi", reason: "Şifre hatalı" },
  0x98: { decision: "reddedildi", label: "Personel no tanımlı değil", reason: "Personel no tanımlı değil" },
  0x99: { decision: "izin_verildi", label: "Birleşik doğrulama tamamlandı" },
  0x9a: { decision: "reddedildi", label: "Birleşik doğrulama zaman aşımı", reason: "Doğrulama zaman aşımı" },
  0x9b: { decision: "reddedildi", label: "Doğrulama tipi uyuşmadı", reason: "Doğrulama tipi uyuşmadı" },
  0x9c: { decision: "izin_verildi", label: "QR kod doğrulandı" },
  0x9d: { decision: "reddedildi", label: "QR kod doğrulama başarısız", reason: "QR kod geçersiz" },
  0x9f: { decision: "izin_verildi", label: "Bluetooth ile doğrulandı" },
  0xa0: { decision: "reddedildi", label: "Bluetooth doğrulama başarısız", reason: "Bluetooth doğrulama başarısız" },
  0xa2: { decision: "reddedildi", label: "Geçersiz M1 kart", reason: "Geçersiz kart" },
  0xa3: { decision: "reddedildi", label: "CPU kart şifreleme doğrulaması başarısız", reason: "Kart şifreleme hatası" },
  0xb3: { decision: "izin_verildi", label: "Dinamik kod doğrulandı" },
  0xb4: { decision: "reddedildi", label: "Dinamik kod doğrulama başarısız", reason: "Dinamik kod geçersiz" },
  0xb5: { decision: "izin_verildi", label: "Şifre doğrulandı" },
  0xbe: { decision: "izin_verildi", label: "İris doğrulandı" },
  0xbf: { decision: "reddedildi", label: "İris doğrulama başarısız", reason: "İris eşleşmedi" },
  0xc0: { decision: "reddedildi", label: "İris canlılık testi başarısız", reason: "İris canlılık testi başarısız" },
  0xca: { decision: "reddedildi", label: "Parmak izi tanıma kapalı", reason: "Parmak izi tanıma kapalı" },
  0xcb: { decision: "reddedildi", label: "Yüz yakalama kapalı", reason: "Yüz yakalama kapalı" },
};

const accessCodesWhere = (decision: HikAccessCode["decision"]): ReadonlySet<number> =>
  new Set(
    Object.entries(HIK_ACCESS_CODES)
      .filter(([, c]) => c.decision === decision)
      .map(([code]) => Number(code)),
  );

/** subEventType (minor) -> izin verildi */
export const HIK_SUB_EVENT_GRANTED: ReadonlySet<number> = accessCodesWhere("izin_verildi");

/** subEventType (minor) -> reddedildi */
export const HIK_SUB_EVENT_DENIED: ReadonlySet<number> = accessCodesWhere("reddedildi");

/**
 * Spesifik ret nedeni - UI'da "Reddedildi (Yetki yok)" gibi gösterilir.
 */
export const HIK_DENIAL_REASONS: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(HIK_ACCESS_CODES).flatMap(([code, c]) =>
    c.reason ? [[Number(code), c.reason]] : [],
  ),
);

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

// MAJOR_EVENT kapı durum kodları (MINOR_LOCK_OPEN / MINOR_LOCK_CLOSE) — status olarak kalır.
const HIK_STATUS_LABELS: Record<number, string> = {
  0x15: "Kapı kilidi açıldı",
  0x16: "Kapı kilitlendi",
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
        label: HIK_ACCESS_CODES[subEventType]?.label ?? `Geçiş izni (${subEventType})`,
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
        label: HIK_ACCESS_CODES[subEventType]?.label ?? `Geçiş reddi (${subEventType})`,
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
          : HIK_STATUS_LABELS[subEventType] ?? `Cihaz durum olayı (${subEventType})`,
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
