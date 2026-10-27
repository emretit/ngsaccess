import { deviceBrandLabel } from "@/lib/deviceBrand";
import { getHikModelSpec } from "../../../../convex/lib/hikModels";

interface ReaderDevice { deviceType?: string; brand?: string; hikModel?: string; isActive?: boolean }
const cardTypes = new Set([
  "kart okuyucu", "rfid okuyucu", "card-reader", "wiegand", "wiegand okuyucu",
  "kontrol paneli", "erişim paneli", "erişim terminali", "kapı kontrolörü", "access_control",
]);

export function canCaptureVisitorCard(device: ReaderDevice): boolean {
  if (device.isActive === false) return false;
  const type = device.deviceType?.trim().toLocaleLowerCase("tr").replace(/ı/g, "i") ?? "";
  if (/qr|sanal|virtual/.test(type)) return false;
  if (device.brand === "hikvision") {
    const model = getHikModelSpec(device.hikModel?.trim().toUpperCase());
    if (model) return model.family === "terminal" || model.family === "controller";
  }
  return cardTypes.has(type) || device.brand === "ide_smart";
}

export function visitorReaderLabel(device: ReaderDevice & { name: string }): string {
  return `${device.name} · ${deviceBrandLabel(device.brand)}${device.deviceType ? ` · ${device.deviceType}` : ""}`;
}
