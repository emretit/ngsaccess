import { z } from "zod";

export const DEVICE_BRANDS = ["hikvision", "other"] as const;
export type DeviceBrand = (typeof DEVICE_BRANDS)[number];

export const BRAND_LABELS: Record<DeviceBrand, string> = {
  hikvision: "Hikvision",
  other: "Diğer",
};

export const formSchema = z.object({
  brand: z.enum(DEVICE_BRANDS).default("other"),
  name: z.string().min(1, "Cihaz adı gereklidir"),
  device_serial: z.string().min(1, "Seri numarası gereklidir"),
  device_type: z.enum(["Kart Okuyucu", "Parmak İzi Okuyucu", "Yüz Tanıma", "QR Kod Okuyucu", "RFID Okuyucu", "Erişim Terminali", "Turnike", "Kapı Kontrolörü", "Diğer"]),
  zone_id: z.string().optional(),
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
}).superRefine((data, ctx) => {
  if (data.brand === "hikvision") {
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
});

export type FormValues = z.infer<typeof formSchema>;
