import { z } from "zod";
import { MANUAL_MODEL_ID } from "../../../../convex/lib/hikModels";

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
export function makeFormSchema(adminMode: boolean, isEdit = false) {
  return z.object({
  brand: z.enum(DEVICE_BRANDS).default("other"),
  name: adminMode ? z.string().default("") : z.string().min(1, "Cihaz adı gereklidir"),
  device_serial: z.string().optional(),
  device_type: z.enum(["Kontrol Paneli", "Kart Okuyucu", "Parmak İzi Okuyucu", "Yüz Tanıma", "QR Kod Okuyucu", "RFID Okuyucu", "Erişim Terminali", "Erişim Paneli", "Turnike", "Kapı Kontrolörü", "Diğer"]),
  zone_id: z.string().optional(),
  // IDE panel eklerken yeni bölge oluşturma adı (zone_id === "__new__" iken kullanılır).
  new_zone_name: z.string().optional(),
  door_id: z.string().optional(),
  // Cihazın kontrol ettiği genel kapı sayısı (1–8). Kapı seçimi yerine bu girilir.
  door_count: doorCountField,
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
  // Opsiyonel: düzenlemede kayıtlı değer yüklenir; seçilmemiş cihazda "Seçin" kalır (zorla
  // gateway'e düşürmek yanıltıcıydı). Hikvision için superRefine'da seçim zorunlu tutulur.
  hik_transport: z.enum(["gateway", "localBridge"]).optional(),
  // Hikvision cihaz modeli (katalog id'si veya MANUAL_MODEL_ID). Kapı/okuyucu sayısı
  // bundan türetilir; yeni cihaz eklerken zorunlu (superRefine), manuel ise kapı sayısı istenir.
  hik_model: z.string().optional(),
  hik_door_count: doorCountField,
  // localBridge panel SDK portu (default 8000). Boş → undefined (backend default'u).
  // max 65535: bridge tarafı Port'u 16-bit okur; aralık dışı değer roster'ı düşürür.
  hik_port: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(65535).optional(),
  ),
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
  if (data.brand === "hikvision" && !data.hik_transport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hik_transport"],
      message: "İletişim yöntemi seçin",
    });
  }
  // Yeni cihaz eklerken (admin/düzenleme değil) model zorunlu — kapı/okuyucu sayısı modelden
  // türetilir. Düzenlemede legacy cihazlar modelsiz olabilir → zorlamayız. Manuel modelde
  // kapı sayısı elle girilir.
  if (data.brand === "hikvision" && !adminMode && !isEdit) {
    if (!data.hik_model) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hik_model"],
        message: "Cihaz modeli seçin",
      });
    } else if (data.hik_model === MANUAL_MODEL_ID && data.hik_door_count === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hik_door_count"],
        message: "Kapı sayısı gerekli",
      });
    }
  }
  // ehome yalnız gateway transport'ta zorunlu (localBridge LAN bridge token ile auth olur).
  if (data.brand === "hikvision" && data.hik_transport === "gateway") {
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
