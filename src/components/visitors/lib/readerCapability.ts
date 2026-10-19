import { deviceBrandLabel } from "@/lib/deviceBrand";

interface ReaderDevice { deviceType?: string; brand?: string; isActive?: boolean }
const cardTypes = new Set([
  "kart okuyucu", "rfid okuyucu", "card-reader", "wiegand", "wiegand okuyucu",
  "kontrol paneli", "erişim paneli", "erişim terminali", "kapı kontrolörü", "access_control",
]);

export function canCaptureVisitorCard(device: ReaderDevice): boolean {
  if (device.isActive === false) return false;
  const type = device.deviceType?.trim().toLocaleLowerCase("tr").replace(/ı/g, "i") ?? "";
  if (/qr/.test(type)) return false;
  return cardTypes.has(type) || device.brand === "ide_smart";
}

export function visitorReaderLabel(device: ReaderDevice & { name: string }): string {
  return `${device.name} · ${deviceBrandLabel(device.brand)}${device.deviceType ? ` · ${device.deviceType}` : ""}`;
}
