/**
 * Hikvision cihaz modeli kataloğu — kapı/okuyucu topolojisini modelden türetir.
 *
 * Bağımlılıksız saf TS (convex/values import ETMEZ) → hem backend (convex/*) hem
 * frontend (src/*) bu modülü import edebilir. Frontend zaten convex/_generated
 * altından import ediyor; bu dosya da aynı şekilde paylaşılır.
 *
 * Topoloji notu: Hikvision kontrolörlerinde bir kapının fiziksel olarak giriş + çıkış
 * okuyucusu (en çok 2) olabilir. Sahadaki kurulum çoğunlukla kapı başına TEK okuyucu
 * (yalnız giriş) — ör. DS-K2804 = 4 kapı / 4 okuyucu. İkinci okuyucu UI'dan sonradan
 * eklenir. Terminaller (DS-K1Txxx) tek kapı + tek okuyucudur (terminalin kendisi okuyucu).
 */

export type HikFamily = "controller" | "terminal";

export interface HikModelSpec {
  /** Model kimliği (device.hikModel'e yazılır). */
  id: string;
  /** UI'da gösterilen etiket. */
  label: string;
  family: HikFamily;
  /** Modelin kontrol ettiği kapı sayısı. */
  doorCount: number;
  /** Cihaz eklenirken kapı başına otomatik üretilecek okuyucu sayısı (DS-K2804 → 1). */
  defaultReadersPerDoor: number;
  /** Kapı başına izin verilen en çok okuyucu (kontrolör → 2, terminal → 1). */
  maxReadersPerDoor: number;
  /** Boşsa formda transport önerisi olarak kullanılır. */
  transportHint?: "gateway" | "localBridge";
}

export const HIK_MODELS: readonly HikModelSpec[] = [
  {
    id: "DS-K2804",
    label: "DS-K2804 (4 kapılı kontrolör)",
    family: "controller",
    doorCount: 4,
    defaultReadersPerDoor: 1,
    maxReadersPerDoor: 2,
    transportHint: "localBridge",
  },
  {
    id: "DS-K1T807",
    label: "DS-K1T807 (terminal)",
    family: "terminal",
    doorCount: 1,
    defaultReadersPerDoor: 1,
    maxReadersPerDoor: 1,
    transportHint: "gateway",
  },
  {
    id: "DS-K1T343",
    label: "DS-K1T343 (terminal)",
    family: "terminal",
    doorCount: 1,
    defaultReadersPerDoor: 1,
    maxReadersPerDoor: 1,
    transportHint: "gateway",
  },
] as const;

/** "Diğer (manuel)" seçeneği — kapı sayısı elle girilir, kontrolör varsayar (2 okuyucu/kapı). */
export const MANUAL_MODEL_ID = "__manual__";

/** Manuel/bilinmeyen model için varsayılan kapı sayısı. */
export const MANUAL_DEFAULT_DOOR_COUNT = 4;

export function getHikModelSpec(id: string | undefined): HikModelSpec | undefined {
  if (!id) return undefined;
  return HIK_MODELS.find((m) => m.id === id);
}

export interface ResolvedHikSpec {
  doorCount: number;
  defaultReadersPerDoor: number;
  maxReadersPerDoor: number;
}

/**
 * Form değerlerinden efektif kapı/okuyucu sayısını çözer. Katalog modeli varsa onun
 * spec'i; manuel ise elle girilen kapı sayısı + kontrolör varsayımı (1 okuyucu/kapı,
 * en çok 2). Bilinmeyen id de manuel gibi ele alınır (ileri uyum).
 */
export function resolveHikModelSpec(
  id: string | undefined,
  manualDoorCount?: number,
): ResolvedHikSpec {
  const spec = getHikModelSpec(id);
  if (spec) {
    return {
      doorCount: spec.doorCount,
      defaultReadersPerDoor: spec.defaultReadersPerDoor,
      maxReadersPerDoor: spec.maxReadersPerDoor,
    };
  }
  const doorCount = Math.max(1, Math.min(manualDoorCount ?? MANUAL_DEFAULT_DOOR_COUNT, 8));
  return { doorCount, defaultReadersPerDoor: 1, maxReadersPerDoor: 2 };
}
