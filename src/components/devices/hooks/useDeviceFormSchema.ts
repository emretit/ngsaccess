
import { z } from "zod";

export const formSchema = z.object({
  name: z.string().min(1, "Cihaz adı gereklidir"),
  serial_number: z.string().min(1, "Seri numarası gereklidir"),
  device_model_enum: z.enum(["QR Reader", "Fingerprint Reader", "RFID Reader", "Access Control Terminal", "Other"]),
  zone_id: z.number().optional(),
  door_id: z.number().optional(),
  access_direction: z.enum(["entry", "exit", "both"]).default("both"),
  device_mac: z.string().optional(),
  device_ip: z.string().optional(),
  device_firmware: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;
