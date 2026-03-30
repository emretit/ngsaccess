// @ts-nocheck

import { z } from "zod";

export const formSchema = z.object({
  name: z.string().min(1, "Cihaz adı gereklidir"),
  device_serial: z.string().min(1, "Seri numarası gereklidir"),
  device_type: z.enum(["Kart Okuyucu", "Parmak İzi Okuyucu", "Yüz Tanıma", "QR Kod Okuyucu", "RFID Okuyucu", "Erişim Terminali", "Turnike", "Kapı Kontrolörü", "Diğer"]),
  zone_id: z.string().optional(),
  door_id: z.string().optional(),
  access_direction: z.enum(["entry", "exit", "both"]).default("both"),
  device_ip: z.string().optional(),
  device_username: z.string().optional(),
  device_password: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type FormValues = z.infer<typeof formSchema>;
