import { z } from "zod";

export const DEVICE_BRANDS = ["hikvision", "other", "ide_smart"] as const;
export type DeviceBrand = (typeof DEVICE_BRANDS)[number];

export const BRAND_LABELS: Record<DeviceBrand, string> = {
  hikvision: "Hikvision",
  other: "Diğer",
  ide_smart: "IDE Smart Panel",
};

/**
 * Kapı sayısı alanı — IDE Smart ve Hikvision localBridge ortak kullanır.
 * Boş input ("") z.coerce.number() ile 0'a düşüp .min() validasyonuna takılmasın
 * diye boş/null önce undefined'a indirilir (opsiyonel alan); 1–8 arası tam sayı.
 */
const doorCountField = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().min(1).max(8).optional(),
);

/**
 * Form şeması fabrikası.
 *
 * Admin akışında (super_admin cihazı projeye ekler) cihaz adı kullanıcıdan
 * istenmez; isim seri no / UUID'den türetilir. Bu yüzden `name` admin modunda
 * zorunlu olmaktan çıkar (`.default("")` ile çıktı yine `string` kalır → FormValues
 * tipi değişmez). Diğer tüm zorunluluklar (seri no, ehome, UUID/IP) admin'in de
 * ihtiyacı olduğundan superRefine aynen korunur.
 */
export function makeFormSchema(adminMode: boolean) {
  return z.object({
  brand: z.enum(DEVICE_BRANDS).default("other"),
  name: adminMode ? z.string().default("") : z.string().min(1, "Cihaz adı gereklidir"),
  device_serial: z.string().optional(),
  device_type: z.enum(["Kart Okuyucu", "Parmak İzi Okuyucu", "Yüz Tanıma", "QR Kod Okuyucu", "RFID Okuyucu", "Erişim Terminali", "Erişim Paneli", "Turnike", "Kapı Kontrolörü", "Diğer"]),
  zone_id: z.string().optional(),
  // IDE panel eklerken yeni bölge oluşturma adı (zone_id === "__new__" iken kullanılır).
  new_zone_name: z.string().optional(),
  door_id: z.string().optional(),
  access_direction: z.enum(["entry", "exit", "both"]),
  device_ip: z.string().optional(),
  device_username: z.string().optional(),
  device_password: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  // Hikvision-specific (brand === "hikvision" ise zorunlu)
  ehome_id: z.string().optional(),
  ehome_key: z.string().optional(),
  // Hikvision transport: "gateway" (ISUP→Hetzner) veya "localBridge" (LAN'daki Windows EXE).
  hik_transport: z.enum(["gateway", "localBridge"]).default("gateway"),
  hik_door_count: doorCountField,
  // IDE Smart panel (brand === "ide_smart")
  ide_uuid: z.string().optional(),
  ide_user: z.string().optional(),
  ide_password: z.string().optional(),
  // Boş input ("") z.coerce.number() ile 0'a dönüşüp .positive()/.min() validasyonuna
  // takılmasın diye boş/null değerleri önce undefined'a indir (opsiyonel alan).
  ide_http_port: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  ide_door_count: doorCountField,
}).superRefine((data, ctx) => {
  // localBridge transport ehome/gateway kimliği kullanmaz (LAN bridge token ile auth olur);
  // ehome alanları yalnız gateway transport'ta zorunludur.
  if (data.brand === "hikvision" && data.hik_transport !== "localBridge") {
    if (!data.ehome_id?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ehome_id"],
        message: "Hikvision cihazlar için Ehome ID zorunlu",
      });
    }
    if (!data.ehome_key?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ehome_key"],
        message: "Şifreleme anahtarı zorunlu",
      });
    }
  }
  if (data.brand === "ide_smart") {
    // "+ Yeni bölge oluştur" seçildiyse ad zorunlu — boş bırakılırsa backend panel
    // adına düşer (bu refactor'ün önlemek istediği "panel adı = bölge adı" durumu).
    if (data.zone_id === "__new__" && !data.new_zone_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["new_zone_name"],
        message: "Yeni bölge adı zorunlu",
      });
    }
    // IDE Smart paneller yalnızca MQTT kullanır. Zorunlu: UUID (tek tanımlayıcı) +
    // kullanıcı/şifre (panel MQTT login token'ı bu kimlikle alınır). IP/port opsiyonel.
    if (!data.ide_uuid?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ide_uuid"],
        message: "Panel UUID zorunlu",
      });
    }
    if (!data.ide_user?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ide_user"],
        message: "Kullanıcı adı zorunlu",
      });
    }
    if (!data.ide_password?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ide_password"],
        message: "Şifre zorunlu",
      });
    }
  } else if (!data.device_serial?.trim()) {
    // Hikvision/diğer için seri no gerekli (IDE panelde serial yok).
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["device_serial"],
      message: "Seri numarası gereklidir",
    });
  }
  });
}

/** Proje (tam) form şeması — geriye dönük uyum için varsayılan export. */
export const formSchema = makeFormSchema(false);

export type FormValues = z.infer<typeof formSchema>;
